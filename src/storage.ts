import browser from "webextension-polyfill";


export interface Entry {
    url: string;
    enabled: boolean;
    resources: string[];
    protocols: string[];
    wildcard: boolean;
}

export interface Storage {
    enabled: boolean;
    urls: Entry[];
    wildcard: boolean;
}

export async function getSettings(): Promise<Storage> {
    const settings = ["urls", "wildcard", "enabled"];

    return browser.storage.local.get(settings).then((result) => {
        return {
            enabled: result.enabled !== undefined ? result.enabled : true,
            urls: result.urls || [],
            wildcard: result.wildcard || false
        };
    });
}

export async function removeURL(url: string) {
    const settings = await getSettings();

    const urls = settings.urls.filter((u) => u.url !== url);
    settings.urls = urls;

    await saveSettings(settings);
}

export async function saveSettings(settings: Storage) {
    await browser.storage.local.set(settings);
}

export async function saveURL(url: string) {
    const settings = await getSettings();

    if (!settings.urls.find(entry => entry.url === url)) {
        settings.urls.push(
            {
                url,
                enabled: true,
                resources: [],
                protocols: [],
                wildcard: true
            }
        );

        await saveSettings(settings);
    }
}

export async function toggleURL(url: string, enabled: boolean) {
    const settings = await getSettings();
    const entry = settings.urls.find(entry => entry.url === url);

    if (entry) {
        entry.enabled = enabled;
        await saveSettings(settings);
    }
}
