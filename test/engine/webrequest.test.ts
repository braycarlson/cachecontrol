import { RESOURCES_DEFAULT } from "../../src/constant";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ruleBuild, settingsSeed } from "../helpers";
import { diagnosticGet } from "../../src/diagnostic";
import { sync, unregister } from "../../src/engine/webrequest";
import { testBrowser, webRequest } from "../browser";
import type { HeaderListener, HttpHeader } from "../stubs/network";

const HEADERS_REPLACEMENT: HttpHeader[] = [
    { name: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
    { name: "Expires", value: "0" },
    { name: "Pragma", value: "no-cache" },
    { name: "Surrogate-Control", value: "no-store" },
];

function received(): HeaderListener {
    const [entry] = webRequest.onHeadersReceived.entries;

    if (!entry) throw new Error("No response listener was registered.");

    return entry.listener;
}

function sending(): HeaderListener {
    const [entry] = webRequest.onBeforeSendHeaders.entries;

    if (!entry) throw new Error("No request listener was registered.");

    return entry.listener;
}

beforeEach(() => {
    unregister();
});

describe("registration", () => {
    it("adds one listener pair per active rule", async () => {
        await settingsSeed([ruleBuild("a.example"), ruleBuild("b.example")]);

        await sync();

        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(2);
        expect(webRequest.onHeadersReceived.entries).toHaveLength(2);
    });

    it("carries the compiled urls and types as the filter", async () => {
        await settingsSeed([ruleBuild("example.com/app", { resources: ["script", "image"], wildcard: false })]);

        await sync();

        const [entry] = webRequest.onBeforeSendHeaders.entries;

        expect(entry?.filter.types).toEqual(["script", "image"]);
        expect(entry?.filter.urls.toSorted()).toEqual([
            "http://example.com/app",
            "http://example.com/app/",
            "https://example.com/app",
            "https://example.com/app/",
        ]);
    });

    it("asks for the blocking header specs each event needs", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        expect(webRequest.onBeforeSendHeaders.entries[0]?.extra).toEqual(["blocking", "requestHeaders"]);
        expect(webRequest.onHeadersReceived.entries[0]?.extra).toEqual(["blocking", "responseHeaders"]);
    });

    it("skips a disabled rule", async () => {
        await settingsSeed([ruleBuild("a.example", { enabled: false }), ruleBuild("b.example")]);

        expect(await sync()).toBe(0);
        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(1);
    });

    it("registers a rule stored with no resources, because an empty stored array is an older rule that meant every resource", async () => {
        await settingsSeed([ruleBuild("example.com", { resources: [] })]);

        expect(await sync()).toBe(0);
        expect(webRequest.onBeforeSendHeaders.entries[0]?.filter.types).toHaveLength(RESOURCES_DEFAULT.length);
    });

    it("skips a rule whose url does not parse and counts it", async () => {
        await settingsSeed([ruleBuild("example.com", { url: "://x" }), ruleBuild("b.example")]);

        expect(await sync()).toBe(1);
        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(1);
    });

    it("registers nothing when the extension is off", async () => {
        await settingsSeed([ruleBuild("example.com")], false);

        await sync();

        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(0);
    });

    it("rolls the pair back and counts the rule when addListener throws", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        webRequest.onHeadersReceived.fail = true;

        expect(await sync()).toBe(1);
        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(0);
        expect(webRequest.onHeadersReceived.entries).toHaveLength(0);
    });

    it("records the reason a listener was refused instead of dropping it", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        webRequest.onHeadersReceived.fail = true;

        await sync();

        const diagnostic = await diagnosticGet();

        expect(diagnostic?.message).toContain("example.com");
        expect(diagnostic?.message).toContain("The listener was rejected.");
    });

    it("leaves one listener set when two runs overlap", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        const first = sync();
        const second = sync();

        await Promise.all([first, second]);

        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(1);
        expect(webRequest.onHeadersReceived.entries).toHaveLength(1);
    });

    it("reports nothing from the run another run superseded", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        const [first, second] = await Promise.all([sync(), sync()]);

        expect(first).toBeNull();
        expect(second).toBe(0);
    });

    it("reports nothing when a later run takes over while the failure is recorded", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        webRequest.onHeadersReceived.fail = true;

        const later: Promise<number | null>[] = [];
        const original = testBrowser.storage.local.set.bind(testBrowser.storage.local);
        const set = vi.spyOn(testBrowser.storage.local, "set");

        set.mockImplementation(async values => {
            if (Object.hasOwn(values, "diagnostic")) {
                webRequest.onHeadersReceived.fail = false;

                if (later.length === 0) later.push(sync());
            }

            await original(values);
        });

        expect(await sync()).toBeNull();

        set.mockRestore();

        await Promise.all(later);
    });

    it("never drops the listener set while two runs overlap", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        const sampled: number[] = [];

        function sample(): void {
            sampled.push(webRequest.onBeforeSendHeaders.entries.length);
        }

        const first = sync().then(sample);
        const second = sync().then(sample);

        sample();

        await Promise.all([first, second]);

        expect(sampled).toEqual([1, 1, 1]);
    });

    it("replaces the listener set on every run", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();
        await sync();
        await sync();

        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(1);
    });
});

describe("the resource matrix", () => {
    it.each([...RESOURCES_DEFAULT])("filters both listeners to %s alone when a rule selects only it", async resource => {
        await settingsSeed([ruleBuild("example.com", { resources: [resource] })]);

        await sync();

        expect(webRequest.onBeforeSendHeaders.entries[0]?.filter.types).toEqual([resource]);
        expect(webRequest.onHeadersReceived.entries[0]?.filter.types).toEqual([resource]);
    });

    it("filters both listeners to every resource type for a rule that selects them all", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        expect(webRequest.onBeforeSendHeaders.entries[0]?.filter.types).toEqual([...RESOURCES_DEFAULT]);
        expect(webRequest.onHeadersReceived.entries[0]?.filter.types).toEqual([...RESOURCES_DEFAULT]);
    });
});

describe("unregister", () => {
    it("empties everything registration added", async () => {
        await settingsSeed([ruleBuild("a.example"), ruleBuild("b.example")]);

        await sync();

        unregister();

        expect(webRequest.onBeforeSendHeaders.entries).toHaveLength(0);
        expect(webRequest.onHeadersReceived.entries).toHaveLength(0);
    });
});

describe("the header rewrite", () => {
    beforeEach(async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();
    });

    it("drops a blocked request header whatever its casing and appends the set once", () => {
        const result = sending()({
            requestHeaders: [
                { name: "CACHE-CONTROL", value: "max-age=3600" },
                { name: "pragma", value: "cache" },
                { name: "X-Test", value: "1" },
            ],
            url: "http://example.com/",
        });

        expect(result.requestHeaders).toEqual([{ name: "X-Test", value: "1" }, ...HEADERS_REPLACEMENT]);
    });

    it("drops a blocked response header whatever its casing and appends the set once", () => {
        const result = received()({
            responseHeaders: [
                { name: "expires", value: "Wed, 21 Oct 2026 07:28:00 GMT" },
                { name: "Surrogate-Control", value: "max-age=60" },
                { name: "ETag", value: "\"abc\"" },
            ],
            url: "http://example.com/",
        });

        expect(result.responseHeaders).toEqual([{ name: "ETag", value: "\"abc\"" }, ...HEADERS_REPLACEMENT]);
    });

    it("appends the set to a request carrying no headers at all", () => {
        expect(sending()({ url: "http://example.com/" }).requestHeaders).toEqual(HEADERS_REPLACEMENT);
    });
});

describe("the port guard", () => {
    it("admits a request whose default port is the one the rule names", async () => {
        await settingsSeed([ruleBuild("localhost:80")]);

        await sync();

        expect(sending()({ url: "http://localhost/" }).requestHeaders).toEqual(HEADERS_REPLACEMENT);
        expect(sending()({ url: "http://localhost:8080/" }).requestHeaders).toBeUndefined();
    });

    it("admits a secure request whose default port is the one the rule names", async () => {
        await settingsSeed([ruleBuild("example.com:443")]);

        await sync();

        expect(received()({ url: "https://example.com/" }).responseHeaders).toEqual(HEADERS_REPLACEMENT);
        expect(received()({ url: "https://example.com:8443/" }).responseHeaders).toBeUndefined();
    });

    it("admits every port when the rule names none", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        expect(sending()({ url: "http://example.com/" }).requestHeaders).toEqual(HEADERS_REPLACEMENT);
        expect(sending()({ url: "https://example.com:8443/" }).requestHeaders).toEqual(HEADERS_REPLACEMENT);
    });

    it("admits the port a rule names outright", async () => {
        await settingsSeed([ruleBuild("localhost:3000")]);

        await sync();

        expect(sending()({ url: "http://localhost:3000/" }).requestHeaders).toEqual(HEADERS_REPLACEMENT);
        expect(sending()({ url: "http://localhost:3001/" }).requestHeaders).toBeUndefined();
    });
});
