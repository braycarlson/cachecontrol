import {
    canonical,
    groupCount,
    groupError,
    groupsSort,
    isMatchable,
    presetUrls,
    ruleCreate,
    ruleError,
    ruleFind,
    ruleGroups,
    rulePort,
    schemeAdd,
} from "../src/rules";
import {
    GROUPS_COUNT_MAX,
    PORT_MAX,
    PORT_MIN,
    PROTOCOLS_DEFAULT,
    RESOURCES_DEFAULT,
    RULES_COUNT_MAX,
} from "../src/constant";
import { describe, expect, it } from "vitest";

describe("schemeAdd", () => {
    it("prefixes bare input with https", () => {
        expect(schemeAdd("localhost:3000")).toBe("https://localhost:3000");
    });

    it("passes through anything already carrying a scheme", () => {
        expect(schemeAdd("http://localhost")).toBe("http://localhost");
        expect(schemeAdd("ftp://localhost")).toBe("ftp://localhost");
    });

    it("prefixes input whose separator sits in the path rather than after a scheme", () => {
        expect(schemeAdd("a.aa/://")).toBe("https://a.aa/://");
        expect(schemeAdd("://x")).toBe("https://://x");
    });
});

describe("isMatchable", () => {
    it("accepts a bare host", () => {
        expect(isMatchable("example.com")).toBe(true);
    });

    it("accepts a host carrying a port", () => {
        expect(isMatchable("localhost:3000")).toBe(true);
    });

    it("accepts a host carrying a path", () => {
        expect(isMatchable("example.com/app")).toBe(true);
    });

    it("accepts a bracketed IPv6 host", () => {
        expect(isMatchable("[::1]:8080")).toBe(true);
    });

    it("accepts the punycode an IDN host parses into", () => {
        expect(isMatchable("bücher.example")).toBe(true);
    });

    it("accepts a single label carrying an underscore", () => {
        expect(isMatchable("my_host")).toBe(true);
    });

    it("rejects empty input", () => {
        expect(isMatchable("")).toBe(false);
    });

    it("rejects whitespace", () => {
        expect(isMatchable("   ")).toBe(false);
    });

    it("rejects a bare scheme", () => {
        expect(isMatchable("https://")).toBe(false);
    });

    it("rejects a scheme that is neither http nor https", () => {
        expect(isMatchable("chrome://settings")).toBe(false);
        expect(isMatchable("ftp://host")).toBe(false);
        expect(isMatchable("file:///tmp")).toBe(false);
        expect(isMatchable("moz-extension://abc/options.html")).toBe(false);
    });

    it("rejects a hostname the label regex refuses", () => {
        expect(isMatchable("foo-.com")).toBe(false);
        expect(isMatchable("-foo.com")).toBe(false);
    });
});

describe("rulePort", () => {
    it("reads an explicit port as a number", () => {
        expect(rulePort("localhost:3000")).toBe(3000);
        expect(rulePort("http://localhost:3000/app")).toBe(3000);
    });

    it("reads a port the URL parser would drop as a scheme default", () => {
        expect(rulePort("localhost:80")).toBe(80);
        expect(rulePort("example.com:443")).toBe(443);
        expect(rulePort("http://example.com:80")).toBe(80);
        expect(rulePort("https://example.com:443")).toBe(443);
    });

    it("reads nothing from a host naming no port", () => {
        expect(rulePort("example.com")).toBeNull();
        expect(rulePort("https://example.com/app")).toBeNull();
    });

    it("reads a port at each end of the range the parser admits", () => {
        expect(rulePort(`example.com:${PORT_MIN}`)).toBe(PORT_MIN);
        expect(rulePort(`example.com:${PORT_MAX}`)).toBe(PORT_MAX);
    });

    it("reads nothing from an authority the parser refuses", () => {
        expect(rulePort(`example.com:${PORT_MAX + 1}`)).toBeNull();
        expect(rulePort("://x")).toBeNull();
    });
});

describe("canonical", () => {
    it("trims and lowercases", () => {
        expect(canonical("  HTTP://LOCALHOST:3000  ")).toBe("localhost:3000");
    });

    it("collapses equivalent spellings onto one value", () => {
        const forms = ["localhost:3000", "http://localhost:3000", "HTTP://LOCALHOST:3000", "https://localhost:3000"];

        expect(new Set(forms.map(canonical)).size).toBe(1);
    });

    it("is idempotent", () => {
        const forms = ["example.com", "example.com:443", "http://example.com/app", "[::1]:8080", "://x"];

        for (const form of forms) expect(canonical(canonical(form))).toBe(canonical(form));
    });

    it("keeps a port the rule names, so a rule for a default port stays a rule for that port", () => {
        expect(canonical("example.com:443")).toBe("example.com:443");
        expect(canonical("http://example.com:80")).toBe("example.com:80");
    });

    it("drops a bare root path", () => {
        expect(canonical("example.com/")).toBe("example.com");
        expect(canonical("https://example.com")).toBe("example.com");
    });

    it("preserves a path", () => {
        expect(canonical("example.com/app")).toBe("example.com/app");
        expect(canonical("https://example.com/app/")).toBe("example.com/app/");
    });

    it("preserves the brackets of an IPv6 host", () => {
        expect(canonical("http://[::1]:8080")).toBe("[::1]:8080");
    });

    it("returns the trimmed input when nothing parses", () => {
        expect(canonical("  ://x  ")).toBe("://x");
    });
});

describe("ruleCreate", () => {
    it("stores the canonical form", () => {
        expect(ruleCreate("HTTP://LOCALHOST:3000").url).toBe("localhost:3000");
    });

    it("starts enabled, wildcarded, and covering every protocol and resource", () => {
        const rule = ruleCreate("example.com");

        expect(rule.enabled).toBe(true);
        expect(rule.wildcard).toBe(true);
        expect(rule.protocols).toEqual([...PROTOCOLS_DEFAULT]);
        expect(rule.resources).toEqual([...RESOURCES_DEFAULT]);
    });

    it("starts unnamed and ungrouped", () => {
        const rule = ruleCreate("example.com");

        expect(rule.name).toBe("");
        expect(rule.group).toBe("");
    });

    it("crashes on a url that is blank once trimmed", () => {
        expect(() => ruleCreate("   ")).toThrow("assert:");
    });
});

describe("ruleGroups", () => {
    it("collects the groups across rules in alphabetical order", () => {
        const rules = [
            ruleCreate("a.example"),
            { ...ruleCreate("b.example"), group: "Work" },
            { ...ruleCreate("c.example"), group: "Backend" },
        ];

        expect(ruleGroups(rules)).toEqual(["Backend", "Work"]);
    });

    it("holds one spelling of a group, the first winning", () => {
        const rules = [
            { ...ruleCreate("a.example"), group: "Frontend" },
            { ...ruleCreate("b.example"), group: "frontend" },
        ];

        expect(ruleGroups(rules)).toEqual(["Frontend"]);
    });

    it("collects nothing from rules carrying no group", () => {
        expect(ruleGroups([ruleCreate("a.example")])).toEqual([]);
    });
});

describe("groupCount", () => {
    it("counts the rules a group holds, whatever the spelling", () => {
        const rules = [
            { ...ruleCreate("a.example"), group: "Work" },
            { ...ruleCreate("b.example"), group: "work" },
            { ...ruleCreate("c.example"), group: "Backend" },
            ruleCreate("d.example"),
        ];

        expect(groupCount(rules, "WORK")).toBe(2);
        expect(groupCount(rules, "Backend")).toBe(1);
        expect(groupCount(rules, "Missing")).toBe(0);
    });
});

describe("groupError", () => {
    it("refuses a name that is blank once trimmed", () => {
        expect(groupError("   ", [])).toBe("Enter a group name.");
    });

    it("refuses a name another group already carries, whatever the spelling", () => {
        expect(groupError("work", ["Work"])).toBe("A group with this name already exists.");
    });

    it("accepts a name no group carries", () => {
        expect(groupError("Office", ["Work"])).toBe("");
    });

    it("accepts the name the group being renamed already carries", () => {
        expect(groupError("  Work  ", ["Work"], "Work")).toBe("");
    });

    it("refuses another group's name while renaming", () => {
        expect(groupError("Office", ["Office", "Work"], "Work")).toBe("A group with this name already exists.");
    });

    it("refuses another group once the list is full", () => {
        const groups = Array.from({ length: GROUPS_COUNT_MAX }, (_, index) => `Group ${index}`);

        expect(groupError("One More", groups)).toContain(String(GROUPS_COUNT_MAX));
    });

    it("still renames a group while the list is full", () => {
        const groups = Array.from({ length: GROUPS_COUNT_MAX }, (_, index) => `Group ${index}`);

        expect(groupError("Renamed", groups, "Group 0")).toBe("");
    });
});

describe("groupsSort", () => {
    it("orders alphabetically without touching the input", () => {
        const groups = ["Work", "Backend"];

        expect(groupsSort(groups)).toEqual(["Backend", "Work"]);
        expect(groups).toEqual(["Work", "Backend"]);
    });
});

describe("presetUrls", () => {
    it("covers each preset host on the port", () => {
        expect(presetUrls(3000)).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
    });

    it("returns urls that canonicalize onto one host and port each", () => {
        expect(presetUrls(8080).map(canonical)).toEqual(["localhost:8080", "127.0.0.1:8080"]);
    });

    it("crashes on a port outside the range", () => {
        expect(() => presetUrls(PORT_MIN - 1)).toThrow("assert:");
        expect(() => presetUrls(PORT_MAX + 1)).toThrow("assert:");
        expect(() => presetUrls(3000.5)).toThrow("assert:");
    });
});

describe("ruleError", () => {
    it("asks for a URL when the input is blank", () => {
        expect(ruleError("", [])).toBe("Enter a URL.");
        expect(ruleError("   ", [])).toBe("Enter a URL.");
    });

    it("refuses input no rule can match", () => {
        expect(ruleError("chrome://settings", [])).toBe("That is not a URL a rule can match.");
        expect(ruleError("foo-.com", [])).toBe("That is not a URL a rule can match.");
    });

    it("catches a duplicate spelled another way", () => {
        const rules = [ruleCreate("http://localhost:3000")];

        expect(ruleError("localhost:3000", rules)).toBe("A rule for this URL already exists.");
        expect(ruleError("HTTP://LOCALHOST:3000", rules)).toBe("A rule for this URL already exists.");
    });

    it("returns nothing for a URL no rule holds", () => {
        expect(ruleError("localhost:3001", [ruleCreate("localhost:3000")])).toBe("");
    });

    it("refuses another rule once the list is full", () => {
        const rules = Array.from({ length: RULES_COUNT_MAX }, (_, index) => ruleCreate(`host${index}.example`));

        expect(ruleError("one.more.example", rules)).toContain(String(RULES_COUNT_MAX));
    });

    it("still names the duplicate ahead of the count when the list is full", () => {
        const rules = Array.from({ length: RULES_COUNT_MAX }, (_, index) => ruleCreate(`host${index}.example`));

        expect(ruleError("host0.example", rules)).toBe("A rule for this URL already exists.");
    });

    it("crashes on a rule list longer than the maximum", () => {
        const rules = Array.from({ length: RULES_COUNT_MAX + 1 }, (_, index) => ruleCreate(`host${index}.example`));

        expect(() => ruleError("one.more.example", rules)).toThrow("assert:");
    });
});

describe("ruleFind", () => {
    it("finds a rule spelled another way than the host", () => {
        const rules = [ruleCreate("http://localhost:3000")];

        expect(ruleFind(rules, "localhost:3000")).toBe(rules[0]);
    });

    it("finds a rule stored before canonicalization", () => {
        const rules = [{ ...ruleCreate("localhost:3000"), url: "HTTPS://LOCALHOST:3000/" }];

        expect(ruleFind(rules, "localhost:3000")).toBe(rules[0]);
    });

    it("finds nothing for an empty host", () => {
        expect(ruleFind([ruleCreate("example.com")], "")).toBeUndefined();
    });

    it("agrees with canonical on a host naming no port", () => {
        const rules = [ruleCreate("https://example.com")];

        expect(ruleFind(rules, "example.com")).toBe(rules[0]);
        expect(ruleFind(rules, "example.com:8443")).toBeUndefined();
    });

    it("agrees with canonical on a host naming a default port", () => {
        const rules = [ruleCreate("example.com:443")];

        expect(ruleFind(rules, "example.com:443")).toBe(rules[0]);
        expect(ruleFind(rules, "example.com")).toBeUndefined();
    });
});
