import fc from "fast-check";
import { settingsBuild } from "./helpers";
import { canonical, isMatchable, ruleCreate, schemeAdd } from "../src/rules";
import { compile } from "../src/engine/compile";
import { describe, expect, it } from "vitest";
import { PORT_MAX } from "../src/constant";
import { regexFilter } from "../src/engine/dnr";
import type { RuleCompiled } from "../src/engine/compile";

const HOSTS = [
    "localhost",
    "example.com",
    "127.0.0.1",
    "my_host",
    "a.b.example",
];

const PATHS = [
    "",
    "/app",
    "/a/b",
    "/app/",
];

function compiledFor(url: string): RuleCompiled {
    const { rules } = compile(settingsBuild([ruleCreate(url)]));
    const [compiled] = rules;

    if (!compiled) throw new Error(`The rule for ${url} did not compile.`);

    return compiled;
}

describe("canonical", () => {
    it("reaches a fixed point on any input at all", () => {
        fc.assert(fc.property(fc.string(), value => {
            const once = canonical(value);

            return canonical(once) === once;
        }));
    });

    it("hands back a url the parser still accepts", () => {
        fc.assert(fc.property(fc.webUrl(), value => URL.canParse(schemeAdd(canonical(value)))));
    });

    it("keeps a matchable url matchable", () => {
        fc.assert(fc.property(fc.webUrl(), value => {
            if (!isMatchable(value)) return true;

            return isMatchable(canonical(value));
        }));
    });

    it("never hands back outer whitespace", () => {
        fc.assert(fc.property(fc.string(), value => canonical(value) === canonical(value).trim()));
    });
});

describe("regexFilter", () => {
    it("matches the url the rule was compiled from", () => {
        fc.assert(fc.property(
            fc.constantFrom(...HOSTS),
            fc.integer({ max: PORT_MAX, min: 1 }),
            fc.constantFrom(...PATHS),
            (host, port, path) => {
                const compiled = compiledFor(`${host}:${port}${path}`);

                return compiled.targets.every(target => {
                    const pattern = new RegExp(regexFilter(compiled, target), "u");
                    const { href } = new URL(`${target.protocol}://${host}:${port}${path === "" ? "/" : path}`);

                    return pattern.test(href);
                });
            },
        ));
    });

    it("rejects the same url on another port", () => {
        fc.assert(fc.property(
            fc.constantFrom(...HOSTS),
            fc.integer({ max: PORT_MAX - 1, min: 1 }),
            (host, port) => {
                const compiled = compiledFor(`${host}:${port}`);

                return compiled.targets.every(target => {
                    const pattern = new RegExp(regexFilter(compiled, target), "u");
                    const { href } = new URL(`${target.protocol}://${host}:${port + 1}/`);

                    return !pattern.test(href);
                });
            },
        ));
    });

    it("stays anchored at the start whatever the host", () => {
        fc.assert(fc.property(fc.constantFrom(...HOSTS), host => {
            const compiled = compiledFor(host);

            return compiled.targets.every(target => regexFilter(compiled, target).startsWith("^"));
        }));
    });
});

describe("the property suite", () => {
    it("runs against a working fast-check", () => {
        expect(() => {
            fc.assert(fc.property(fc.integer(), value => value === value + 1));
        }).toThrow();
    });
});
