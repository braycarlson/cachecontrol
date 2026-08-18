import browser from "webextension-polyfill";
import { assert } from "../assert";
import { diagnosticClear, diagnosticGet, errorDescribe } from "../diagnostic";
import { nonceCreate, settingsCreate, settingsGet, settingsSave, skippedGet } from "../storage";
import { onUnmounted, ref, toRaw } from "vue";
import { useToast } from "./toast";
import type { Diagnostic } from "../diagnostic";
import type { Ref } from "vue";
import type { Settings } from "../storage";
import type { Storage } from "webextension-polyfill";

export interface SettingsStore {
    diagnostic: Ref<Diagnostic | null>;
    dismiss: () => Promise<void>;
    ready: Ref<boolean>;
    refresh: () => Promise<void>;
    save: () => Promise<boolean>;
    settings: Ref<Settings>;
    skipped: Ref<number>;
}

export function useSettings(): SettingsStore {
    const { notify } = useToast();

    const diagnostic = ref<Diagnostic | null>(null);
    const ready = ref(false);
    const settings = ref<Settings>(settingsCreate());
    const skipped = ref(0);

    let nonce = "";

    async function dismiss(): Promise<void> {
        diagnostic.value = null;

        await diagnosticClear();
    }

    async function refresh(): Promise<void> {
        settings.value = await settingsGet();
        skipped.value = await skippedGet();
        diagnostic.value = await diagnosticGet();
        ready.value = true;

        assert(skipped.value >= 0, "the skipped count is not negative");
    }

    async function save(): Promise<boolean> {
        nonce = nonceCreate();

        assert(nonce !== "", "a save carries a nonce");

        try {
            await settingsSave(toRaw(settings.value), nonce);

            return true;
        } catch (cause) {
            notify(`The change was not saved. ${errorDescribe(cause)}`, "error");

            await refresh();

            return false;
        }
    }

    function storageChanged(changes: Record<string, Storage.StorageChange>, area: string): void {
        if (area !== "local") return;
        if (changes["nonce"]?.newValue === nonce) return;

        void refresh();
    }

    browser.storage.onChanged.addListener(storageChanged);
    onUnmounted(() => {
        browser.storage.onChanged.removeListener(storageChanged);
    });

    void refresh();

    return { diagnostic, dismiss, ready, refresh, save, settings, skipped };
}
