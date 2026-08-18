import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import type { BrowserContext, Page } from "@playwright/test";

export interface ChromeApi {
    declarativeNetRequest: {
        getDynamicRules: () => Promise<{ id: number }[]>;
    };
    storage: {
        local: {
            clear: () => Promise<void>;
            set: (values: Record<string, unknown>) => Promise<void>;
        };
    };
}

export interface Loaded {
    close: () => Promise<void>;
    context: BrowserContext;
    id: string;
    privileged: Page;
}

export interface SeedRule {
    enabled?: boolean;
    group?: string;
    name?: string;
    protocols?: string[];
    resources?: string[];
    url: string;
    wildcard?: boolean;
}

const PROTOCOLS_DEFAULT = ["http", "https"];

const READY_POLL_MS = 25;

const READY_TIMEOUT_MS = 15_000;

const RESOURCES_DEFAULT = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "other",
];

export async function dynamicRuleCount(loaded: Loaded): Promise<number> {
    return loaded.privileged.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: ChromeApi }).chrome;

        return (await api.declarativeNetRequest.getDynamicRules()).length;
    });
}

export function extensionDirectory(): string {
    const path = resolve(import.meta.dirname, "..", "dist", "chrome");

    if (!existsSync(path)) throw new Error("Run `bun run build:chrome` before the chromium suite.");

    return path;
}

export async function extensionLoad(): Promise<Loaded> {
    const path = extensionDirectory();
    const profile = await mkdtemp(resolve(tmpdir(), "cachecontrol-"));

    const context = await chromium.launchPersistentContext(profile, {
        args: [
            `--disable-extensions-except=${path}`,
            `--load-extension=${path}`,
            "--no-first-run",
            "--no-default-browser-check",
        ],
        channel: process.env["CHROME_CHANNEL"] ?? "chromium",
        headless: true,
    });

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;

    const privileged = await context.newPage();

    await privileged.goto(`chrome-extension://${id}/src/options/index.html`);

    return {
        close: async (): Promise<void> => {
            await context.close();
            await rm(profile, { force: true, recursive: true });
        },
        context,
        id,
        privileged,
    };
}

export async function ruleCountWait(loaded: Loaded, count: number): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (await dynamicRuleCount(loaded) === count) return;

        await new Promise(settled => {
            setTimeout(settled, READY_POLL_MS);
        });
    }

    throw new Error(`The extension did not settle on ${count} dynamic rules.`);
}

export function ruleOf(rule: SeedRule): Record<string, unknown> {
    return {
        enabled: rule.enabled ?? true,
        group: rule.group ?? "",
        name: rule.name ?? "",
        protocols: rule.protocols ?? PROTOCOLS_DEFAULT,
        resources: rule.resources ?? RESOURCES_DEFAULT,
        url: rule.url,
        wildcard: rule.wildcard ?? true,
    };
}

export async function seed(loaded: Loaded, rules: SeedRule[], enabled = true, groups: string[] = []): Promise<void> {
    await loaded.privileged.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: ChromeApi }).chrome;

        await api.storage.local.clear();
    });

    await ruleCountWait(loaded, 0);

    await loaded.privileged.evaluate(async values => {
        const api = (globalThis as unknown as { chrome: ChromeApi }).chrome;

        await api.storage.local.set(values);
    }, { enabled, groups, rules: rules.map(ruleOf), schema: 3 });
}
