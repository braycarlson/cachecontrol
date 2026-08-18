import browser from "webextension-polyfill";
import { assert } from "../assert";
import { compile, matchPatterns, portMatches } from "./compile";
import { diagnosticSave, errorDescribe } from "../diagnostic";
import { HEADERS_CACHE_DISABLED } from "../constant";
import { settingsGet } from "../storage";
import type { RuleCompiled } from "./compile";
import type { WebRequest } from "webextension-polyfill";

const HEADERS_BLOCKED = new Set(
    Object.keys(HEADERS_CACHE_DISABLED).map(name => name.toLowerCase()),
);

const HEADERS_REPLACEMENT = Object.entries(HEADERS_CACHE_DISABLED).map(
    ([name, value]) => ({ name, value }),
);

const RULE_LISTENERS_COUNT = 2;

let generation = 0;
let registrations: (() => void)[] = [];

function headersRewrite(headers: WebRequest.HttpHeaders | undefined): WebRequest.HttpHeaders {
    const source = headers ?? [];
    const kept = source.filter(header => !HEADERS_BLOCKED.has(header.name.toLowerCase()));
    const rewritten = [...kept, ...HEADERS_REPLACEMENT];

    assert(kept.length <= source.length, "a rewrite never invents a header");
    assert(rewritten.length >= HEADERS_REPLACEMENT.length, "a rewrite carries the replacement set");

    return rewritten;
}

function register(rule: RuleCompiled): string | null {
    const types = rule.resources;
    const urls = matchPatterns(rule);

    assert(types.length > 0, "a registered rule names at least one resource");
    assert(urls.length > 0, "a registered rule names at least one match pattern");

    function onBeforeSendHeaders(
        details: WebRequest.OnBeforeSendHeadersDetailsType,
    ): WebRequest.BlockingResponse {
        if (!portMatches(details.url, rule.port)) return {};

        return { requestHeaders: headersRewrite(details.requestHeaders) };
    }

    function onHeadersReceived(
        details: WebRequest.OnHeadersReceivedDetailsType,
    ): WebRequest.BlockingResponse {
        if (!portMatches(details.url, rule.port)) return {};

        return { responseHeaders: headersRewrite(details.responseHeaders) };
    }

    try {
        browser.webRequest.onBeforeSendHeaders.addListener(
            onBeforeSendHeaders,
            { types, urls },
            ["blocking", "requestHeaders"],
        );

        browser.webRequest.onHeadersReceived.addListener(
            onHeadersReceived,
            { types, urls },
            ["blocking", "responseHeaders"],
        );
    } catch (cause) {
        browser.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
        browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);

        return `${rule.url}: ${errorDescribe(cause)}`;
    }

    assert(registrations.length % RULE_LISTENERS_COUNT === 0, "the registration list holds whole listener pairs");

    registrations.push(
        () => {
            browser.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
        },
        () => {
            browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
        },
    );

    return null;
}

export async function sync(): Promise<number | null> {
    const current = generation + 1;

    generation = current;

    assert(current > 0, "a sync generation numbers from one");

    const settings = await settingsGet();

    if (generation !== current) return null;

    const { rules, skipped } = compile(settings);

    unregister();

    const failures: string[] = [];

    for (const rule of rules) {
        const failure = register(rule);

        if (failure !== null) failures.push(failure);
    }

    assert(failures.length <= rules.length, "no rule fails to register more than once");
    assert(
        registrations.length === (rules.length - failures.length) * RULE_LISTENERS_COUNT,
        "every registered rule holds one listener pair",
    );

    if (failures.length > 0) await diagnosticSave(failures.join(" "));

    if (generation !== current) return null;

    return skipped + failures.length;
}

export function unregister(): void {
    assert(registrations.length % RULE_LISTENERS_COUNT === 0, "registrations come in listener pairs");

    for (const remove of registrations) remove();

    registrations = [];
}
