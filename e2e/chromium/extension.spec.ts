import { dynamicRuleCount, extensionLoad, seed } from "../extension";
import { expect, test } from "@playwright/test";
import { harnessStart } from "../server";
import type { Harness } from "../server";
import type { Loaded } from "../extension";
import type { Page } from "@playwright/test";

const LOADS = 6;

let loaded: Loaded;
let page: Page;
let primary: Harness;
let secondary: Harness;

async function ready(count: number): Promise<void> {
    await expect.poll(async () => dynamicRuleCount(loaded), { timeout: 15_000 }).toBe(count);
}

async function run(harness: Harness, loads = LOADS): Promise<void> {
    harness.reset();

    for (let load = 1; load <= loads; load += 1) {
        await page.goto(`${harness.origin}/page?load=${load}&loads=${loads}`, { waitUntil: "load" });
    }
}

test.beforeAll(async () => {
    primary = await harnessStart();
    secondary = await harnessStart();
    loaded = await extensionLoad();
    page = await loaded.context.newPage();
});

test.afterAll(async () => {
    await loaded.close();
    await primary.close();
    await secondary.close();
});

test.describe.serial("the declarativeNetRequest engine", () => {
    test("leaves the cache alone with no rule, which is the control", async () => {
        await seed(loaded, []);
        await ready(0);

        await run(primary);

        expect(primary.count("/page")).toBe(LOADS);
        expect(primary.count("/asset.js")).toBeLessThanOrEqual(1);
        expect(primary.injected("/asset.js")).toBe(false);
    });

    test("re-fetches the subresource on every load under a matching rule", async () => {
        await seed(loaded, [{ url: `127.0.0.1:${primary.port}` }]);
        await ready(2);

        await run(primary);

        expect(primary.count("/asset.js")).toBe(LOADS);
        expect(primary.count("/asset.css")).toBe(LOADS);
        expect(primary.count("/asset.png")).toBe(LOADS);
    });

    test("injects the request cache headers the server can see", async () => {
        await seed(loaded, [{ url: `127.0.0.1:${primary.port}` }]);
        await ready(2);

        await run(primary, 2);

        const asset = primary.log.find(entry => entry.path === "/asset.js");

        expect(asset?.cacheControl).toContain("no-store");
        expect(asset?.pragma).toBe("no-cache");
    });

    test("leaves the cache alone when the rule names another port", async () => {
        await seed(loaded, [{ url: `127.0.0.1:${secondary.port}` }]);
        await ready(2);

        await run(primary);

        expect(primary.count("/asset.js")).toBeLessThanOrEqual(1);
        expect(primary.injected("/asset.js")).toBe(false);
    });

    test("covers every port when the rule names none", async () => {
        await seed(loaded, [{ url: "127.0.0.1" }]);
        await ready(2);

        await run(primary);
        await run(secondary);

        expect(primary.count("/asset.js")).toBe(LOADS);
        expect(secondary.count("/asset.js")).toBe(LOADS);
    });

    test("touches only the resource types the rule selected", async () => {
        await seed(loaded, [{ resources: ["main_frame", "script"], url: `127.0.0.1:${primary.port}` }]);
        await ready(2);

        await run(primary);

        expect(primary.count("/asset.js")).toBe(LOADS);
        expect(primary.count("/asset.png")).toBeLessThanOrEqual(1);
    });

    test("stops touching requests when the global toggle goes off", async () => {
        await seed(loaded, [{ url: `127.0.0.1:${primary.port}` }], false);
        await ready(0);

        await run(primary);

        expect(primary.count("/asset.js")).toBeLessThanOrEqual(1);
    });

    test("stops touching requests when the rule itself goes off", async () => {
        await seed(loaded, [{ enabled: false, url: `127.0.0.1:${primary.port}` }]);
        await ready(0);

        await run(primary);

        expect(primary.count("/asset.js")).toBeLessThanOrEqual(1);
    });

    test("takes a rule that comes back on without an extension reload", async () => {
        await seed(loaded, [{ enabled: false, url: `127.0.0.1:${primary.port}` }]);
        await ready(0);

        await seed(loaded, [{ url: `127.0.0.1:${primary.port}` }]);
        await ready(2);

        await run(primary);

        expect(primary.count("/asset.js")).toBe(LOADS);
    });
});

test.describe.serial("the extension pages", () => {
    test("renders the options page", async () => {
        await seed(loaded, [{ url: "localhost:3000" }]);

        const options = await loaded.context.newPage();

        await options.goto(`chrome-extension://${loaded.id}/src/options/index.html`);
        await options.getByRole("button", { name: "Rules" }).click();

        await expect(options.getByText("localhost:3000")).toBeVisible();

        await options.close();
    });

    test("renders the popup", async () => {
        const popup = await loaded.context.newPage();

        await popup.goto(`chrome-extension://${loaded.id}/src/popup/index.html`);

        await expect(popup.getByText("CacheControl", { exact: true })).toBeVisible();
        await expect(popup.getByRole("switch", { name: "Enable CacheControl" })).toBeVisible();
        await expect(popup.getByRole("switch")).toHaveCount(1);

        await popup.close();
    });
});
