import browser from "webextension-polyfill";
import { assert } from "../assert";
import { diagnosticSave, errorDescribe } from "../diagnostic";
import { migrate, skippedSave } from "../storage";
import { SYNC_DEBOUNCE_MS } from "../constant";
import { sync as syncDeclarative } from "./dnr";
import { sync as syncWebRequest } from "./webrequest";
import type { Storage } from "webextension-polyfill";

export interface Engine {
    declarative: boolean;
    sync: () => Promise<number | null>;
}

const KEYS_WATCHED = ["enabled", "rules", "schema"];

function apiAvailable(api: unknown): boolean {
    return api !== undefined && api !== null;
}

export async function boot(engine: Engine): Promise<number | null> {
    await migrate();

    return run(engine);
}

export function engineSelect(): Engine {
    const declarative = apiAvailable(browser.declarativeNetRequest) && !apiAvailable(browser.webRequest);

    return { declarative, sync: declarative ? syncDeclarative : syncWebRequest };
}

async function run(engine: Engine): Promise<number | null> {
    const skipped = await engine.sync();

    if (skipped === null) return null;

    assert(Number.isInteger(skipped), "a sync reports an integer count");
    assert(skipped >= 0, "a sync reports a count that is not negative");

    try {
        await skippedSave(skipped);
    } catch (cause) {
        await diagnosticSave(`The skipped count was not saved. ${errorDescribe(cause)}`);

        return null;
    }

    return skipped;
}

export function start(engine: Engine): void {
    assert(apiAvailable(browser.runtime), "the runtime api is there to start from");

    if (!engine.declarative) {
        void boot(engine);

        return;
    }

    assert(apiAvailable(browser.declarativeNetRequest), "the declarative engine has its api");

    browser.runtime.onInstalled.addListener(() => {
        void boot(engine);
    });

    browser.runtime.onStartup.addListener(() => {
        void boot(engine);
    });
}

export function watch(engine: Engine): void {
    assert(KEYS_WATCHED.length > 0, "the watcher watches at least one key");
    assert(apiAvailable(browser.storage), "the storage api is there to watch");

    let pending: ReturnType<typeof setTimeout> | null = null;

    browser.storage.onChanged.addListener((changes: Record<string, Storage.StorageChange>, area: string) => {
        if (area !== "local") return;
        if (!KEYS_WATCHED.some(key => Object.hasOwn(changes, key))) return;

        if (pending !== null) clearTimeout(pending);

        pending = setTimeout(() => {
            pending = null;

            void run(engine);
        }, SYNC_DEBOUNCE_MS);
    });
}
