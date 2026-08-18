import { boot, engineSelect, start, watch } from "../../src/engine";
import { flush, ruleBuild, settingsSeed } from "../helpers";
import { apisInstall, declarativeNetRequest, fake, testBrowser, webRequest } from "../browser";
import { describe, expect, it, vi } from "vitest";
import { diagnosticGet } from "../../src/diagnostic";
import { SCHEMA, skippedGet } from "../../src/storage";
import { SYNC_DEBOUNCE_MS } from "../../src/constant";
import { sync as syncDeclarative } from "../../src/engine/dnr";
import { sync as syncWebRequest } from "../../src/engine/webrequest";
import { unregister } from "../../src/engine/webrequest";

const SETTLE_MS = SYNC_DEBOUNCE_MS * 3;

async function syncNothing(): Promise<number | null> {
    await Promise.resolve();

    return null;
}

async function syncTwo(): Promise<number | null> {
    await Promise.resolve();

    return 2;
}

describe("engineSelect", () => {
    it("picks webRequest when blocking webRequest is there", () => {
        apisInstall({ dnr: true, web: true });

        const engine = engineSelect();

        expect(engine.declarative).toBe(false);
        expect(engine.sync).toBe(syncWebRequest);
    });

    it("picks declarativeNetRequest when webRequest is absent", () => {
        apisInstall({ dnr: true, web: false });

        const engine = engineSelect();

        expect(engine.declarative).toBe(true);
        expect(engine.sync).toBe(syncDeclarative);
    });

    it("falls back to webRequest when declarativeNetRequest is absent", () => {
        apisInstall({ dnr: false, web: true });

        expect(engineSelect().declarative).toBe(false);
    });
});

describe("boot", () => {
    it("migrates before it syncs", async () => {
        await testBrowser.storage.local.set({ urls: [{ url: "example.com" }], wildcard: true });

        await boot(engineSelect());

        expect(await testBrowser.storage.local.get(["urls", "wildcard", "schema"])).toEqual({ schema: SCHEMA });
        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(1);

        unregister();
    });
});

describe("the skipped count", () => {
    it("lands in storage when a rule cannot be registered", async () => {
        apisInstall({ dnr: false, web: true });

        await settingsSeed([ruleBuild("example.com", { url: "://x" }), ruleBuild("b.example")]);

        expect(await boot(engineSelect())).toBe(1);
        expect(await skippedGet()).toBe(1);

        unregister();
    });

    it("clears once every rule registers", async () => {
        apisInstall({ dnr: false, web: true });

        await testBrowser.storage.local.set({ skipped: 4 });
        await settingsSeed([ruleBuild("b.example")]);

        await boot(engineSelect());

        expect(await skippedGet()).toBe(0);

        unregister();
    });

    it("follows a storage change through the watcher", async () => {
        apisInstall({ dnr: false, web: true });

        watch(engineSelect());

        await settingsSeed([ruleBuild("example.com", { url: "://x" })]);
        await flush(SETTLE_MS);

        expect(await skippedGet()).toBe(1);

        unregister();
    });

    it("stays put when the sync reports nothing", async () => {
        await testBrowser.storage.local.set({ skipped: 4 });

        expect(await boot({ declarative: false, sync: syncNothing })).toBeNull();
        expect(await skippedGet()).toBe(4);
    });

    it("writes the count the sync reports", async () => {
        expect(await boot({ declarative: false, sync: syncTwo })).toBe(2);
        expect(await skippedGet()).toBe(2);
    });

    it("records the reason the count could not be saved", async () => {
        apisInstall({ dnr: false, web: true });

        await settingsSeed([ruleBuild("example.com", { url: "://x" })]);

        const original = testBrowser.storage.local.set.bind(testBrowser.storage.local);
        const set = vi.spyOn(testBrowser.storage.local, "set");

        set.mockImplementation(async values => {
            if (Object.hasOwn(values, "skipped")) throw new Error("QuotaExceededError");

            await original(values);
        });

        expect(await boot(engineSelect())).toBeNull();

        set.mockRestore();

        expect((await diagnosticGet())?.message).toContain("The skipped count was not saved.");

        unregister();
    });
});

describe("start", () => {
    it("syncs at once on a persistent background page", async () => {
        apisInstall({ dnr: false, web: true });

        await settingsSeed([ruleBuild("example.com")]);

        start(engineSelect());

        await flush();

        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(1);

        unregister();
    });

    it("waits for an event on a service worker", async () => {
        apisInstall({ dnr: true, web: false });

        await settingsSeed([ruleBuild("example.com")]);

        start(engineSelect());

        await flush();

        expect(declarativeNetRequest.updates).toHaveLength(0);

        await fake.runtime.onInstalled.trigger({ reason: "install" });
        await flush();

        expect(declarativeNetRequest.updates).toHaveLength(1);

        await fake.runtime.onStartup.trigger();
        await flush();

        expect(declarativeNetRequest.updates).toHaveLength(2);
    });
});

describe("watch", () => {
    it("syncs when a watched key changes in local storage", async () => {
        apisInstall({ dnr: true, web: false });

        watch(engineSelect());

        await settingsSeed([ruleBuild("example.com")]);
        await flush(SETTLE_MS);

        expect(declarativeNetRequest.updates).toHaveLength(1);
    });

    it("stays put when no watched key changed", async () => {
        apisInstall({ dnr: true, web: false });

        watch(engineSelect());

        await testBrowser.storage.local.set({ decoration: "blue" });
        await flush(SETTLE_MS);

        expect(declarativeNetRequest.updates).toHaveLength(0);
    });

    it("stays put when the change lands in another area", async () => {
        apisInstall({ dnr: true, web: false });

        watch(engineSelect());

        await testBrowser.storage.sync.set({ rules: [] });
        await flush(SETTLE_MS);

        expect(declarativeNetRequest.updates).toHaveLength(0);
    });

    it("runs once for a burst of writes", async () => {
        apisInstall({ dnr: true, web: false });

        watch(engineSelect());

        await settingsSeed([ruleBuild("a.example")]);
        await settingsSeed([ruleBuild("b.example")]);
        await settingsSeed([ruleBuild("c.example")]);
        await flush(SETTLE_MS);

        expect(declarativeNetRequest.updates).toHaveLength(1);
    });

    it("holds off until the burst has settled", async () => {
        apisInstall({ dnr: true, web: false });

        watch(engineSelect());

        await settingsSeed([ruleBuild("a.example")]);

        expect(declarativeNetRequest.updates).toHaveLength(0);

        await flush(SETTLE_MS);

        expect(declarativeNetRequest.updates).toHaveLength(1);
    });
});
