import browser from "webextension-polyfill";
import { onMounted, ref } from "vue";
import type { Ref } from "vue";

const PROTOCOLS_SUPPORTED = ["http:", "https:"];

export interface TabCurrent {
    host: Ref<string>;
    origin: Ref<string>;
    resolved: Ref<boolean>;
}

export function useTabCurrent(): TabCurrent {
    const host = ref("");
    const origin = ref("");
    const resolved = ref(false);

    async function tabRead(): Promise<void> {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

        if (tab?.url !== undefined && URL.canParse(tab.url)) {
            const parsed = new URL(tab.url);

            if (PROTOCOLS_SUPPORTED.includes(parsed.protocol)) {
                host.value = parsed.host;
                origin.value = parsed.origin;
            }
        }

        resolved.value = true;
    }

    onMounted(() => {
        void tabRead();
    });

    return { host, origin, resolved };
}
