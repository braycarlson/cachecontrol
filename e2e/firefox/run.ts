import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { harnessStart } from "../server";
import { resolve } from "node:path";
import { ruleOf } from "../extension";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import type { ChildProcess } from "node:child_process";
import type { Harness } from "../server";
import type { SeedRule } from "../extension";

interface Scenario {
    fresh: boolean;
    name: string;
    stored: (port: number) => Record<string, unknown>;
}

const LOADS = 5;

const RUN_TIMEOUT_MS = 90_000;

const STOP_TIMEOUT_MS = 5_000;

let running: ChildProcess | undefined;

const SCENARIOS: Scenario[] = [
    {
        fresh: false,
        name: "no rule leaves the cache alone",
        stored: () => current([]),
    },
    {
        fresh: true,
        name: "a matching rule re-fetches on every load",
        stored: port => current([{ url: `127.0.0.1:${port}` }]),
    },
    {
        fresh: false,
        name: "a rule naming another port leaves the cache alone",
        stored: port => current([{ url: `127.0.0.1:${port + 1}` }]),
    },
    {
        fresh: true,
        name: "a profile carrying the published legacy storage upgrades to a working rule",
        stored: port => legacy(`http://127.0.0.1:${port}`),
    },
];

async function cleanup(child: ChildProcess, harness: Harness, profile: string, source: string): Promise<void> {
    await stop(child);
    await harness.close();
    await rm(profile, { force: true, recursive: true });
    await rm(source, { force: true, recursive: true });
}

function current(rules: SeedRule[]): Record<string, unknown> {
    return { enabled: true, rules: rules.map(ruleOf), schema: 2 };
}

async function drive(scenario: Scenario): Promise<string> {
    const harness = await harnessStart();
    const profile = await mkdtemp(resolve(tmpdir(), "cachecontrol-profile-"));
    const source = await prepare(scenario.stored(harness.port));

    const child = spawn(
        "bunx",
        [
            "web-ext",
            "run",
            "--source-dir",
            source,
            "--start-url",
            `${harness.origin}/start?loads=${LOADS}`,
            "--firefox-profile",
            profile,
            "--keep-profile-changes",
            "--no-input",
            "--no-reload",
            "--no-config-discovery",
            "--args=-headless",
        ],
        { detached: true, stdio: "ignore" },
    );

    running = child;

    try {
        await settle(harness);
    } finally {
        await cleanup(child, harness, profile, source);

        running = undefined;
    }

    const requests = harness.count("/asset.js");
    const injected = harness.injected("/asset.js");

    if (scenario.fresh && requests !== LOADS) {
        return `FAIL ${scenario.name}: expected ${LOADS} subresource requests, saw ${requests}`;
    }

    if (scenario.fresh && !injected) {
        return `FAIL ${scenario.name}: the request cache headers never reached the server`;
    }

    if (!scenario.fresh && requests > 1) {
        return `FAIL ${scenario.name}: expected the cache to serve every load, saw ${requests} requests`;
    }

    if (!scenario.fresh && injected) {
        return `FAIL ${scenario.name}: the extension touched a request it should have left alone`;
    }

    return `PASS ${scenario.name} (${requests}/${LOADS} subresource requests)`;
}

function extensionDirectory(): string {
    const path = resolve(import.meta.dirname, "..", "..", "dist", "firefox");

    if (!existsSync(path)) throw new Error("Run `bun run build:firefox` before the firefox suite.");

    return path;
}

function legacy(url: string): Record<string, unknown> {
    return {
        urls: [{ enabled: true, protocols: [], resources: [], url, wildcard: true }],
        wildcard: true,
    };
}

async function prepare(stored: Record<string, unknown>): Promise<string> {
    const source = await mkdtemp(resolve(tmpdir(), "cachecontrol-firefox-"));

    await cp(extensionDirectory(), source, { recursive: true });

    const path = resolve(source, "manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8")) as {
        background: { scripts: string[] };
    };

    manifest.background.scripts = ["seed.js", ...manifest.background.scripts];

    await writeFile(resolve(source, "seed.js"), `browser.storage.local.set(${JSON.stringify(stored)});\n`, "utf8");
    await writeFile(path, JSON.stringify(manifest), "utf8");

    return source;
}

async function settle(harness: Harness): Promise<void> {
    const deadline = Date.now() + RUN_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (harness.count("/done") > 0) return;

        await new Promise<void>(done => {
            setTimeout(done, 250);
        });
    }

    throw new Error("The harness never reached the final page.");
}

function signal(group: number, code: NodeJS.Signals | 0): boolean {
    try {
        process.kill(group, code);

        return true;
    } catch {
        return false;
    }
}

async function stop(child: ChildProcess): Promise<void> {
    if (child.pid === undefined) return;

    const group = -child.pid;

    if (!signal(group, "SIGTERM")) return;

    const deadline = Date.now() + STOP_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (!signal(group, 0)) return;

        await new Promise<void>(done => {
            setTimeout(done, 100);
        });
    }

    signal(group, "SIGKILL");
}

function sweep(): void {
    const pid = running?.pid;

    if (pid === undefined) return;

    signal(-pid, "SIGKILL");
}

process.once("SIGINT", () => {
    sweep();

    process.exit(130);
});

process.once("SIGTERM", () => {
    sweep();

    process.exit(143);
});

const results: string[] = [];

for (const scenario of SCENARIOS) {
    const line = await drive(scenario);

    process.stdout.write(`${line}\n`);
    results.push(line);
}

if (results.some(line => line.startsWith("FAIL"))) throw new Error("The firefox suite did not pass.");
