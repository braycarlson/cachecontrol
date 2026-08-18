import { ruleBuild, settingsSeed } from "../helpers";
import { declarativeNetRequest } from "../browser";
import { describe, expect, it } from "vitest";
import { diagnosticGet } from "../../src/diagnostic";
import { REGEX_CHECKS_CONCURRENT_MAX, RESOURCES_DEFAULT } from "../../src/constant";
import { sync } from "../../src/engine/dnr";
import type { DnrRule, UpdateOptions } from "../stubs/network";

const HEADERS_REQUEST = [
    { header: "Cache-Control", operation: "set", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
    { header: "Pragma", operation: "set", value: "no-cache" },
];

const HEADERS_RESPONSE = [
    { header: "Cache-Control", operation: "set", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
    { header: "Expires", operation: "set", value: "0" },
    { header: "Pragma", operation: "set", value: "no-cache" },
    { header: "Surrogate-Control", operation: "set", value: "no-store" },
];

function added(): DnrRule[] {
    return latest().addRules ?? [];
}

function filters(): string[] {
    return added().map(rule => rule.condition.regexFilter);
}

function latest(): UpdateOptions {
    const update = declarativeNetRequest.updates.at(-1);

    if (!update) throw new Error("No dynamic rule update was submitted.");

    return update;
}

describe("the submitted payload", () => {
    it("matches one rule per protocol, with the ids, filters, resources, and header actions the engine promises", async () => {
        await settingsSeed([ruleBuild("localhost:3000", { resources: ["main_frame", "script"], wildcard: false })]);

        await sync();

        expect(added()).toEqual([
            {
                action: {
                    requestHeaders: HEADERS_REQUEST,
                    responseHeaders: HEADERS_RESPONSE,
                    type: "modifyHeaders",
                },
                condition: {
                    regexFilter: "^http://localhost:3000/$",
                    resourceTypes: ["main_frame", "script"],
                },
                id: 1,
            },
            {
                action: {
                    requestHeaders: HEADERS_REQUEST,
                    responseHeaders: HEADERS_RESPONSE,
                    type: "modifyHeaders",
                },
                condition: {
                    regexFilter: "^https://localhost:3000/$",
                    resourceTypes: ["main_frame", "script"],
                },
                id: 2,
            },
        ]);
    });

    it("numbers ids from one across every rule and protocol", async () => {
        await settingsSeed([ruleBuild("a.example"), ruleBuild("b.example")]);

        await sync();

        expect(added().map(rule => rule.id)).toEqual([1, 2, 3, 4]);
    });

    it("emits nothing but a removal when the extension is off", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        const ids = added().map(rule => rule.id);

        await settingsSeed([ruleBuild("example.com")], false);

        await sync();

        expect(added()).toEqual([]);
        expect(latest().removeRuleIds).toEqual(ids);
    });
});

describe("the resource matrix", () => {
    it.each([...RESOURCES_DEFAULT])("submits %s alone when a rule selects only it", async resource => {
        await settingsSeed([ruleBuild("example.com", { resources: [resource] })]);

        await sync();

        expect(added().map(rule => rule.condition.resourceTypes)).toEqual([[resource], [resource]]);
    });

    it("submits every resource type in order for a rule that selects them all", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        expect(added().map(rule => rule.condition.resourceTypes)).toEqual([
            [...RESOURCES_DEFAULT],
            [...RESOURCES_DEFAULT],
        ]);
    });
});

describe("the regex filter", () => {
    it("carries no port when the rule names the scheme default", async () => {
        await settingsSeed([ruleBuild("example.com:443")]);

        await sync();

        expect(filters()).toEqual(["^http://example\\.com:443/", "^https://example\\.com/"]);
    });

    it("carries a port the rule names outright", async () => {
        await settingsSeed([ruleBuild("localhost:8080")]);

        await sync();

        expect(filters()).toEqual(["^http://localhost:8080/", "^https://localhost:8080/"]);
    });

    it("admits every port when the rule names none", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        expect(filters()).toEqual(["^http://example\\.com(?::\\d+)?/", "^https://example\\.com(?::\\d+)?/"]);
    });

    it("anchors the end of a rule that does not wildcard", async () => {
        await settingsSeed([ruleBuild("example.com/app", { protocols: ["http"], wildcard: false })]);

        await sync();

        expect(filters()).toEqual(["^http://example\\.com(?::\\d+)?/app/?$"]);
    });

    it("anchors a root path that does not wildcard without doubling the slash", async () => {
        await settingsSeed([ruleBuild("example.com", { protocols: ["http"], wildcard: false })]);

        await sync();

        expect(filters()).toEqual(["^http://example\\.com(?::\\d+)?/$"]);
    });

    it("leaves a wildcard rule open, so a rule for /app also covers /apple", async () => {
        await settingsSeed([ruleBuild("example.com/app", { protocols: ["http"] })]);

        await sync();

        const [filter] = filters();

        expect(filter).toBe("^http://example\\.com(?::\\d+)?/app");
        expect(new RegExp(filter ?? "", "u").test("http://example.com/apple")).toBe(true);
    });

    it("escapes the brackets of an IPv6 host", async () => {
        await settingsSeed([ruleBuild("[::1]:8080", { protocols: ["http"] })]);

        await sync();

        expect(filters()).toEqual(["^http://\\[::1\\]:8080/"]);
    });

    it("compiles to a pattern that admits and rejects the URLs the rule describes", async () => {
        await settingsSeed([ruleBuild("localhost:80", { protocols: ["http"] })]);

        await sync();

        const [filter] = filters();
        const pattern = new RegExp(filter ?? "", "u");

        expect(pattern.test("http://localhost/index.html")).toBe(true);
        expect(pattern.test("http://localhost:8080/index.html")).toBe(false);
    });
});

describe("an unsupported regex", () => {
    it("skips the rule and raises the count", async () => {
        declarativeNetRequest.unsupported = ["localhost"];

        await settingsSeed([ruleBuild("localhost:3000"), ruleBuild("example.com")]);

        expect(await sync()).toBe(1);
        expect(filters()).toEqual(["^http://example\\.com(?::\\d+)?/", "^https://example\\.com(?::\\d+)?/"]);
    });

    it("counts one skip for a rule the browser refuses on every protocol", async () => {
        declarativeNetRequest.unsupported = ["localhost"];

        await settingsSeed([ruleBuild("localhost:3000")]);

        expect(await sync()).toBe(1);
        expect(added()).toEqual([]);
    });

    it("tests every filter it submits", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await sync();

        expect(declarativeNetRequest.tested).toEqual(filters());
    });
});

describe("an update", () => {
    it("removes every existing id and adds the new set in one call", async () => {
        await settingsSeed([ruleBuild("a.example"), ruleBuild("b.example")]);

        await sync();

        const first = added().map(rule => rule.id);

        await settingsSeed([ruleBuild("c.example")]);

        await sync();

        expect(declarativeNetRequest.updates).toHaveLength(2);
        expect(latest().removeRuleIds).toEqual(first);
        expect(added().map(rule => rule.id)).toEqual([1, 2]);
    });

    it("leaves the browser holding only the newest set", async () => {
        await settingsSeed([ruleBuild("a.example"), ruleBuild("b.example")]);

        await sync();

        await settingsSeed([ruleBuild("c.example", { protocols: ["http"] })]);

        await sync();

        expect(await declarativeNetRequest.getDynamicRules()).toHaveLength(1);
    });

    it("submits once when two runs overlap", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        await Promise.all([sync(), sync()]);

        expect(declarativeNetRequest.updates).toHaveLength(1);
    });

    it("reports nothing from the run another run superseded", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        const [first, second] = await Promise.all([sync(), sync()]);

        expect(first).toBeNull();
        expect(second).toBe(0);
    });

    it("drops out at the regex checks when a later run takes over there", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        const later: Promise<number | null>[] = [];

        declarativeNetRequest.onRegexCheck = (): void => {
            declarativeNetRequest.onRegexCheck = null;
            later.push(sync());
        };

        expect(await sync()).toBeNull();

        await Promise.all(later);

        expect(declarativeNetRequest.updates).toHaveLength(1);
    });

    it("drops out at the read-back when a later run takes over there", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        const later: Promise<number | null>[] = [];

        declarativeNetRequest.onGetDynamicRules = (): void => {
            declarativeNetRequest.onGetDynamicRules = null;
            later.push(sync());
        };

        expect(await sync()).toBeNull();

        await Promise.all(later);

        expect(declarativeNetRequest.updates).toHaveLength(1);
    });
});

describe("a refused update", () => {
    it("reports nothing so the caller leaves the stored count alone", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        declarativeNetRequest.updateFails = true;

        expect(await sync()).toBeNull();
    });

    it("records the reason the browser gave", async () => {
        await settingsSeed([ruleBuild("example.com")]);

        declarativeNetRequest.updateFails = true;

        await sync();

        const diagnostic = await diagnosticGet();

        expect(diagnostic?.message).toContain("The browser refused the rule set.");
        expect(diagnostic?.message).toContain("The rule set was refused.");
    });
});

describe("the regex support fan-out", () => {
    it("holds the checks to the concurrency bound", async () => {
        const rules = Array.from({ length: 20 }, (_, index) => ruleBuild(`host${index}.example`));

        await settingsSeed(rules);

        await sync();

        expect(declarativeNetRequest.tested).toHaveLength(rules.length * 2);
        expect(declarativeNetRequest.concurrentMax).toBe(REGEX_CHECKS_CONCURRENT_MAX);
    });

    it("keeps the submitted order the candidate order", async () => {
        const rules = Array.from({ length: 12 }, (_, index) => ruleBuild(`host${index}.example`));

        await settingsSeed(rules);

        await sync();

        expect(declarativeNetRequest.tested).toEqual(filters());
    });

    it("runs no checks at all for an empty rule set", async () => {
        await settingsSeed([]);

        await sync();

        expect(declarativeNetRequest.tested).toEqual([]);
        expect(declarativeNetRequest.concurrentMax).toBe(0);
    });
});
