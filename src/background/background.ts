import browser from "webextension-polyfill";
import { CACHE_DISABLED_HEADERS } from "../constant";
import { getSettings } from "../storage";


function disableCache(
    details: browser.WebRequest.OnBeforeSendHeadersDetailsType |
    browser.WebRequest.OnHeadersReceivedDetailsType
) {
    const headers = (
        (details as browser.WebRequest.OnBeforeSendHeadersDetailsType).requestHeaders ||
        (details as browser.WebRequest.OnHeadersReceivedDetailsType).responseHeaders ||
        []
    );

    const keys = Object.keys(CACHE_DISABLED_HEADERS);

    for (let i = headers.length - 1; i >= 0; i--) {
        if (keys.includes(headers[i].name)) {
            headers.splice(i, 1);
        }
    }

    for (const [key, value] of Object.entries(CACHE_DISABLED_HEADERS)) {
        headers.push({ name: key, value });
    }

    if ((details as browser.WebRequest.OnBeforeSendHeadersDetailsType).requestHeaders) {
        return { requestHeaders: headers };
    } else {
        return { responseHeaders: headers };
    }
}

function generateURL(url: string, wildcard: boolean, protocols: string[]): string[] {
    const variations = new Set<string>();

    // Add protocol if missing
    if (!url.includes("://")) {
        url = "https://" + url;
    }

    const obj = new URL(url);

    const paths = [
        obj.pathname,
        obj.pathname.endsWith('/') ? obj.pathname : obj.pathname + '/'
    ];

    protocols.forEach(protocol => {
        paths.forEach(path => {
            const base = `${protocol}://${obj.host}${path}`;

            variations.add(base);

            if (wildcard) {
                variations.add(`${base}*`);
            }
        });
    });

    return Array.from(variations);
}

async function register() {
    const { urls, enabled } = await getSettings();

    if (enabled && urls.length > 0) {
        if (browser.webRequest.onBeforeSendHeaders.hasListener(disableCache)) {
            browser.webRequest.onBeforeSendHeaders.removeListener(disableCache);
        }

        if (browser.webRequest.onHeadersReceived.hasListener(disableCache)) {
            browser.webRequest.onHeadersReceived.removeListener(disableCache);
        }

        urls.forEach(entry => {
            if (entry.enabled) {
                const patterns = generateURL(entry.url, entry.wildcard, entry.protocols);
                const resourceTypes = entry.resources.filter(r => r !== "all_resources") as browser.WebRequest.ResourceType[];

                if (patterns.length > 0 && resourceTypes.length > 0) {
                    browser.webRequest.onBeforeSendHeaders.addListener(
                        disableCache,
                        { urls: patterns, types: resourceTypes },
                        ["blocking", "requestHeaders"]
                    );

                    browser.webRequest.onHeadersReceived.addListener(
                        disableCache,
                        { urls: patterns, types: resourceTypes },
                        ["blocking", "responseHeaders"]
                    );
                }
            }
        });
    } else {
        if (browser.webRequest.onBeforeSendHeaders.hasListener(disableCache)) {
            browser.webRequest.onBeforeSendHeaders.removeListener(disableCache);
        }
        if (browser.webRequest.onHeadersReceived.hasListener(disableCache)) {
            browser.webRequest.onHeadersReceived.removeListener(disableCache);
        }
    }
}

browser.runtime.onStartup.addListener(register);
browser.storage.onChanged.addListener(register);
browser.runtime.onInstalled.addListener(register);
