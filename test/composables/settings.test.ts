import { beforeEach, describe, expect, it, vi } from "vitest";
import { flush, ruleBuild, settingsSeed, withSetup } from "../helpers";
import { fake, testBrowser } from "../browser";
import { diagnosticGet, diagnosticSave } from "../../src/diagnostic";
import { useSettings } from "../../src/composables/settings";
import { useToast } from "../../src/composables/toast";
import type { SettingsStore } from "../../src/composables/settings";

const { toasts } = useToast();

async function load(): Promise<{ store: SettingsStore; unmount: () => void }> {
    const { result, unmount } = withSetup(useSettings);

    await flush();

    return { store: result, unmount };
}

async function storedNonce(): Promise<unknown> {
    const stored = await testBrowser.storage.local.get("nonce");

    return stored["nonce"];
}

beforeEach(() => {
    toasts.value = [];
});

describe("useSettings", () => {
    it("loads what storage holds when it is created", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        const { store, unmount } = await load();

        expect(store.ready.value).toBe(true);
        expect(store.settings.value.rules.map(rule => rule.url)).toEqual(["example.com"]);

        unmount();
    });

    it("starts from defaults when storage is empty", async () => {
        const { store, unmount } = await load();

        expect(store.settings.value).toEqual({ enabled: true, groups: [], rules: [] });

        unmount();
    });

    it("saves the settings object it holds", async () => {
        const { store, unmount } = await load();

        store.settings.value.rules.push(ruleBuild("localhost:3000"));
        store.settings.value.enabled = false;

        expect(await store.save()).toBe(true);

        const stored = await testBrowser.storage.local.get(["enabled", "rules"]);

        expect(stored["enabled"]).toBe(false);
        expect(stored["rules"]).toHaveLength(1);

        unmount();
    });

    it("refreshes on a storage change another surface wrote", async () => {
        const { store, unmount } = await load();

        await testBrowser.storage.local.set({ rules: [{ url: "foreign.example" }] });
        await flush();

        expect(store.settings.value.rules.map(rule => rule.url)).toEqual(["foreign.example"]);

        unmount();
    });

    it("keeps in-progress edits when the echo of its own save arrives", async () => {
        const { store, unmount } = await load();

        store.settings.value.rules.push(ruleBuild("first.example"));

        await store.save();

        const nonce = await storedNonce();

        store.settings.value.rules.push(ruleBuild("second.example"));

        await fake.storage.onChanged.trigger(
            { nonce: { newValue: nonce }, rules: { newValue: [ruleBuild("first.example")] } },
            "local",
        );
        await flush();

        expect(store.settings.value.rules.map(rule => rule.url)).toEqual(["first.example", "second.example"]);

        unmount();
    });

    it("takes the change when another surface writes its own nonce", async () => {
        const { store, unmount } = await load();

        await store.save();

        await testBrowser.storage.local.set({ nonce: "elsewhere", rules: [{ url: "foreign.example" }] });
        await flush();

        expect(store.settings.value.rules.map(rule => rule.url)).toEqual(["foreign.example"]);

        unmount();
    });

    it("ignores a change in another storage area", async () => {
        const { store, unmount } = await load();

        await testBrowser.storage.sync.set({ rules: [{ url: "sync.example" }] });
        await flush();

        expect(store.settings.value.rules).toEqual([]);

        unmount();
    });

    it("stops listening once the surface unmounts", async () => {
        const { store, unmount } = await load();

        unmount();

        await testBrowser.storage.local.set({ rules: [{ url: "foreign.example" }] });
        await flush();

        expect(store.settings.value.rules).toEqual([]);
    });

    it("raises a toast and re-syncs when the write fails", async () => {
        await settingsSeed([ruleBuild("stored.example")]);

        const { store, unmount } = await load();

        vi.spyOn(testBrowser.storage.local, "set").mockRejectedValue(new Error("QuotaExceededError"));

        store.settings.value.rules.push(ruleBuild("doomed.example"));

        expect(await store.save()).toBe(false);
        expect(toasts.value.map(toast => toast.variant)).toEqual(["error"]);
        expect(store.settings.value.rules.map(rule => rule.url)).toEqual(["stored.example"]);

        vi.restoreAllMocks();
        unmount();
    });

    it("carries the reason the write failed into the toast", async () => {
        const { store, unmount } = await load();

        vi.spyOn(testBrowser.storage.local, "set").mockRejectedValue(new Error("QuotaExceededError"));

        await store.save();

        expect(toasts.value.map(toast => toast.message)).toEqual([
            "The change was not saved. QuotaExceededError",
        ]);

        vi.restoreAllMocks();
        unmount();
    });

    it("reads the diagnostic the background left behind", async () => {
        await diagnosticSave("The browser refused the rule set.");

        const { store, unmount } = await load();

        expect(store.diagnostic.value?.message).toBe("The browser refused the rule set.");

        unmount();
    });

    it("holds no diagnostic when the background left none", async () => {
        const { store, unmount } = await load();

        expect(store.diagnostic.value).toBeNull();

        unmount();
    });

    it("clears the diagnostic on dismissal", async () => {
        await diagnosticSave("The browser refused the rule set.");

        const { store, unmount } = await load();

        await store.dismiss();

        expect(store.diagnostic.value).toBeNull();
        expect(await diagnosticGet()).toBeNull();

        unmount();
    });

    it("picks up a diagnostic another surface wrote", async () => {
        const { store, unmount } = await load();

        await diagnosticSave("The browser refused the rule set.");
        await flush();

        expect(store.diagnostic.value?.message).toBe("The browser refused the rule set.");

        unmount();
    });
});
