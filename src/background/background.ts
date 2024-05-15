import browser from "webextension-polyfill";
import { getSettings } from "../storage";

const CACHE_DISABLED_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store"
};

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

async function register() {
    const { urls, wildcard, enabled, resources } = await getSettings();

    if (enabled && urls.length > 0) {
        const patterns = wildcard ? urls.filter(u => u.enabled).map(url => `${url.url}/*`) : urls.filter(u => u.enabled).map(url => url.url);

        if (browser.webRequest.onBeforeSendHeaders.hasListener(disableCache)) {
            browser.webRequest.onBeforeSendHeaders.removeListener(disableCache);
        }

        if (browser.webRequest.onHeadersReceived.hasListener(disableCache)) {
            browser.webRequest.onHeadersReceived.removeListener(disableCache);
        }

        browser.webRequest.onBeforeSendHeaders.addListener(
            disableCache,
            { urls: patterns, types: resources as browser.WebRequest.ResourceType[] },
            ["blocking", "requestHeaders"]
        );

        browser.webRequest.onHeadersReceived.addListener(
            disableCache,
            { urls: patterns, types: resources as browser.WebRequest.ResourceType[] },
            ["blocking", "responseHeaders"]
        );
    } else {
        if (browser.webRequest.onBeforeSendHeaders.hasListener(disableCache)) {
            browser.webRequest.onBeforeSendHeaders.removeListener(disableCache);
        }
        if (browser.webRequest.onHeadersReceived.hasListener(disableCache)) {
            browser.webRequest.onHeadersReceived.removeListener(disableCache);
        }
    }
}

browser.storage.onChanged.addListener(register);
register();

browser.runtime.onStartup.addListener(register);
browser.runtime.onInstalled.addListener(register);
