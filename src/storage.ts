import browser from "webextension-polyfill";

export interface Entry {
    url: string;
    enabled: boolean;
}

export interface Storage {
    enabled: boolean;
    urls: Entry[];
    wildcard: boolean;
    resources: string[];
}

export async function getSettings(): Promise<Storage> {
    const settings = ["urls", "wildcard", "enabled", "resources"];

    return browser.storage.local.get(settings).then((result) => {
        return {
            enabled: result.enabled !== undefined ? result.enabled : true,
            urls: result.urls || [],
            wildcard: result.wildcard || false,
            resources: result.resources || [
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
                "other"
            ]
        };
    });
}

export async function saveSettings(settings: Storage) {
    await browser.storage.local.set(settings);
}

export async function saveURL(url: string) {
    const settings = await getSettings();

    if (!settings.urls.find(entry => entry.url === url)) {
        settings.urls.push({ url, enabled: true });
        await saveSettings(settings);
    }
}

export async function removeURL(url: string) {
    const settings = await getSettings();

    const urls = settings.urls.filter((u) => u.url !== url);
    settings.urls = urls;

    await saveSettings(settings);
}

export async function toggleURL(url: string, enabled: boolean) {
    const settings = await getSettings();
    const entry = settings.urls.find(entry => entry.url === url);

    if (entry) {
        entry.enabled = enabled;
        await saveSettings(settings);
    }
}
