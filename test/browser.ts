import { declarativeNetRequestCreate, webRequestCreate } from "./stubs/network";
import { fakeBrowser } from "@webext-core/fake-browser";
import type { Browser } from "webextension-polyfill";

export interface EngineApis {
    dnr: boolean;
    web: boolean;
}

const surface = fakeBrowser as unknown as Record<string, unknown>;

export const declarativeNetRequest = declarativeNetRequestCreate();

export const fake = fakeBrowser;

export const webRequest = webRequestCreate();

export const testBrowser = fakeBrowser as unknown as Browser;

export function apisInstall(apis: EngineApis): void {
    if (apis.dnr) {
        surface["declarativeNetRequest"] = declarativeNetRequest;
    } else {
        delete surface["declarativeNetRequest"];
    }

    if (apis.web) {
        surface["webRequest"] = webRequest;
    } else {
        delete surface["webRequest"];
    }
}

export function testBrowserReset(): void {
    fakeBrowser.reset();
    declarativeNetRequest.reset();
    webRequest.reset();
    apisInstall({ dnr: true, web: true });
}
