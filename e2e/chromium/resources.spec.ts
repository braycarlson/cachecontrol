import { dynamicRuleCount, extensionLoad, seed } from "../extension";
import { expect, test } from "@playwright/test";
import { harnessStart } from "../server";
import type { Harness } from "../server";
import type { Loaded } from "../extension";
import type { Page } from "@playwright/test";

// object, websocket, and other never reach this harness: chromium ships no plugins, a
// websocket handshake carries a ws scheme no compiled filter matches, and other is only
// traffic the browser cannot classify. The engine unit suites cover their pass-through.
const PATHS_BY_RESOURCE = {
    csp_report: ["/csp"],
    font: ["/asset.woff2"],
    image: ["/asset.png"],
    main_frame: ["/resources"],
    media: ["/asset.mp4"],
    ping: ["/beacon"],
    script: ["/asset.js"],
    stylesheet: ["/asset.css"],
    sub_frame: ["/frame.html"],
    xmlhttprequest: [
        "/asset.json",
        "/settled",
    ],
} as const;

const SETTLED_PATHS = [
    "/beacon",
    "/csp",
    "/settled",
];

let harness: Harness;
let loaded: Loaded;
let page: Page;

function matrixTest(resource: string, paths: readonly string[]): void {
    test(`touches ${resource} alone when the rule selects only it`, async () => {
        await seed(loaded, [{ resources: [resource], url: `127.0.0.1:${harness.port}` }]);
        await ready(2);

        await visit();

        for (const [other, otherPaths] of Object.entries(PATHS_BY_RESOURCE)) {
            for (const path of otherPaths) {
                expect(harness.injected(path), `${path} under a ${resource} rule`).toBe(other === resource);
            }
        }

        expect(paths.every(path => harness.count(path) > 0), `${resource} reached the server`).toBe(true);
    });
}

async function ready(count: number): Promise<void> {
    await expect.poll(async () => dynamicRuleCount(loaded), { timeout: 15_000 }).toBe(count);
}

async function settledWait(path: string): Promise<void> {
    await expect.poll(() => harness.count(path), { timeout: 15_000 }).toBeGreaterThan(0);
}

async function visit(): Promise<void> {
    harness.reset();

    await page.goto(`${harness.origin}/resources`, { waitUntil: "load" });

    for (const path of SETTLED_PATHS) await settledWait(path);
}

test.beforeAll(async () => {
    harness = await harnessStart();
    loaded = await extensionLoad();
    page = await loaded.context.newPage();
});

test.afterAll(async () => {
    await loaded.close();
    await harness.close();
});

test.describe.serial("the resource matrix", () => {
    test("leaves every resource type alone with no rule, which is the control", async () => {
        await seed(loaded, []);
        await ready(0);

        await visit();

        for (const paths of Object.values(PATHS_BY_RESOURCE)) {
            for (const path of paths) expect(harness.injected(path), path).toBe(false);
        }
    });

    test("injects the cache headers into every resource type under a full rule", async () => {
        await seed(loaded, [{ url: `127.0.0.1:${harness.port}` }]);
        await ready(2);

        await visit();

        for (const paths of Object.values(PATHS_BY_RESOURCE)) {
            for (const path of paths) expect(harness.injected(path), path).toBe(true);
        }
    });

    for (const [resource, paths] of Object.entries(PATHS_BY_RESOURCE)) matrixTest(resource, paths);
});
