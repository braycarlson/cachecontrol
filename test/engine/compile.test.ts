import { ruleBuild, settingsBuild } from "../helpers";
import { compile, matchPatterns, portCanonical, portDefault, portEffective, portMatches } from "../../src/engine/compile";
import { describe, expect, it } from "vitest";
import { PORT_MAX, PORT_MIN, RULES_COUNT_MAX } from "../../src/constant";
import type { RuleCompiled } from "../../src/engine/compile";

function only(url: string, overrides: Parameters<typeof ruleBuild>[1] = {}): RuleCompiled {
    const { rules } = compile(settingsBuild([ruleBuild(url, overrides)]));
    const [compiled] = rules;

    if (!compiled) throw new Error(`The rule for ${url} did not compile.`);

    return compiled;
}

describe("compile", () => {
    it("returns nothing when the extension is off", () => {
        expect(compile(settingsBuild([ruleBuild("example.com")], false))).toEqual({ rules: [], skipped: 0 });
    });

    it("passes over a disabled rule without counting it as skipped", () => {
        expect(compile(settingsBuild([ruleBuild("example.com", { enabled: false })]))).toEqual({
            rules: [],
            skipped: 0,
        });
    });

    it("counts a rule whose url does not parse as skipped", () => {
        const { rules, skipped } = compile(settingsBuild([ruleBuild("example.com", { url: "://x" })]));

        expect(rules).toHaveLength(0);
        expect(skipped).toBe(1);
    });

    it("counts a rule selecting no protocol or no resource as skipped", () => {
        const settings = settingsBuild([
            ruleBuild("a.example", { protocols: [] }),
            ruleBuild("b.example", { resources: [] }),
        ]);

        expect(compile(settings).skipped).toBe(2);
    });

    it("keeps the hostname, the path, and the resource list", () => {
        const compiled = only("https://Example.COM/app", { resources: ["script", "image"] });

        expect(compiled.hostname).toBe("example.com");
        expect(compiled.path).toBe("/app");
        expect(compiled.resources).toEqual(["script", "image"]);
        expect(compiled.wildcard).toBe(true);
    });

    it("reads a root path from a host naming none", () => {
        expect(only("example.com").path).toBe("/");
    });

    it("counts a rule carrying no hostname as skipped", () => {
        const { rules, skipped } = compile(settingsBuild([ruleBuild("example.com", { url: "file:///tmp/page" })]));

        expect(rules).toHaveLength(0);
        expect(skipped).toBe(1);
    });

    it("crashes on a rule list longer than the maximum", () => {
        const rules = Array.from({ length: RULES_COUNT_MAX + 1 }, (_, index) => ruleBuild(`host${index}.example`));

        expect(() => compile(settingsBuild(rules))).toThrow("assert:");
    });

    it("compiles a full rule list without exceeding the browser's ceiling", () => {
        const rules = Array.from({ length: RULES_COUNT_MAX }, (_, index) => ruleBuild(`host${index}.example`));

        expect(compile(settingsBuild(rules)).rules).toHaveLength(RULES_COUNT_MAX);
    });
});

describe("the port a rule expects", () => {
    it("carries no port when the rule names none", () => {
        const compiled = only("example.com");

        expect(compiled.port).toBeNull();
        expect(compiled.targets).toEqual([
            { port: null, protocol: "http" },
            { port: null, protocol: "https" },
        ]);
    });

    it("carries an explicit port on every protocol", () => {
        const compiled = only("localhost:3000");

        expect(compiled.port).toBe(3000);
        expect(compiled.targets).toEqual([
            { port: 3000, protocol: "http" },
            { port: 3000, protocol: "https" },
        ]);
    });

    it("resolves a port that is the default of one protocol and not the other", () => {
        const eighty = only("localhost:80");

        expect(eighty.port).toBe(80);
        expect(eighty.targets).toEqual([
            { port: null, protocol: "http" },
            { port: 80, protocol: "https" },
        ]);

        const secure = only("example.com:443");

        expect(secure.port).toBe(443);
        expect(secure.targets).toEqual([
            { port: 443, protocol: "http" },
            { port: null, protocol: "https" },
        ]);
    });

    it("keeps only the protocols the rule selected", () => {
        expect(only("example.com", { protocols: ["https"] }).targets).toEqual([{ port: null, protocol: "https" }]);
    });
});

describe("portDefault and portCanonical", () => {
    it("resolves the scheme default with and without the colon", () => {
        expect(portDefault("http")).toBe(80);
        expect(portDefault("https:")).toBe(443);
        expect(portDefault("ftp")).toBeNull();
    });

    it("drops a port that is the scheme default", () => {
        expect(portCanonical("http", 80)).toBeNull();
        expect(portCanonical("https", 443)).toBeNull();
    });

    it("keeps a port that is not the scheme default", () => {
        expect(portCanonical("http", 443)).toBe(443);
        expect(portCanonical("https", 80)).toBe(80);
        expect(portCanonical("https", 3000)).toBe(3000);
    });

    it("passes a rule naming no port straight through", () => {
        expect(portCanonical("http", null)).toBeNull();
    });

    it("crashes on a port outside the range", () => {
        expect(() => portCanonical("http", PORT_MAX + 1)).toThrow("assert:");
        expect(() => portCanonical("http", PORT_MIN - 1)).toThrow("assert:");
    });
});

describe("portEffective", () => {
    it("reads the port a URL carries", () => {
        expect(portEffective(new URL("http://localhost:3000/"))).toBe(3000);
    });

    it("resolves the port a URL drops as a scheme default", () => {
        expect(portEffective(new URL("http://localhost/"))).toBe(80);
        expect(portEffective(new URL("https://example.com/"))).toBe(443);
    });

    it("reads nothing from a scheme carrying no default", () => {
        expect(portEffective(new URL("ftp://example.com/"))).toBeNull();
    });
});

describe("portMatches", () => {
    it("admits every port when the rule names none", () => {
        expect(portMatches("http://localhost:9999/", null)).toBe(true);
    });

    it("admits a URL whose default port is the one the rule names", () => {
        expect(portMatches("http://localhost/", 80)).toBe(true);
        expect(portMatches("https://example.com/", 443)).toBe(true);
    });

    it("rejects a URL on another port", () => {
        expect(portMatches("http://localhost:8080/", 80)).toBe(false);
        expect(portMatches("https://example.com:8443/", 443)).toBe(false);
    });

    it("admits a URL naming the port outright", () => {
        expect(portMatches("http://localhost:3000/", 3000)).toBe(true);
    });

    it("rejects a URL that does not parse", () => {
        expect(portMatches("not a url", 80)).toBe(false);
    });

    it("crashes on an expected port outside the range", () => {
        expect(() => portMatches("http://localhost/", PORT_MAX + 1)).toThrow("assert:");
    });
});

describe("matchPatterns", () => {
    it("covers both protocols and both path spellings", () => {
        expect(matchPatterns(only("example.com/app", { wildcard: false })).toSorted()).toEqual([
            "http://example.com/app",
            "http://example.com/app/",
            "https://example.com/app",
            "https://example.com/app/",
        ]);
    });

    it("adds the wildcard form when the rule wildcards", () => {
        expect(matchPatterns(only("example.com/app")).toSorted()).toEqual([
            "http://example.com/app",
            "http://example.com/app*",
            "http://example.com/app/",
            "http://example.com/app/*",
            "https://example.com/app",
            "https://example.com/app*",
            "https://example.com/app/",
            "https://example.com/app/*",
        ]);
    });

    it("emits one path for a root a rule already spells with a slash", () => {
        expect(matchPatterns(only("example.com")).toSorted()).toEqual([
            "http://example.com/",
            "http://example.com/*",
            "https://example.com/",
            "https://example.com/*",
        ]);
    });

    it("never carries a port, because a match pattern carrying one matches nothing", () => {
        for (const pattern of matchPatterns(only("localhost:3000"))) {
            expect(pattern).not.toContain(":3000");
        }
    });

    it("matches a path by prefix under a wildcard, so a rule for /app also covers /apple", () => {
        expect(matchPatterns(only("example.com/app"))).toContain("http://example.com/app*");
    });
});
