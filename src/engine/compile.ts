import { assert } from "../assert";
import { rulePort, schemeAdd } from "../rules";
import { DNR_RULES_COUNT_MAX, PORT_MAX, PORT_MIN, RULES_COUNT_MAX } from "../constant";
import type { Protocol, ResourceType } from "../constant";
import type { Rule, Settings } from "../storage";

export interface Compilation {
    rules: RuleCompiled[];
    skipped: number;
}

export interface RuleCompiled {
    hostname: string;
    path: string;
    port: number | null;
    resources: ResourceType[];
    targets: TargetCompiled[];
    url: string;
    wildcard: boolean;
}

export interface TargetCompiled {
    port: number | null;
    protocol: Protocol;
}

const PORTS_DEFAULT: Record<string, number> = {
    http: 80,
    https: 443,
};

export function compile(settings: Settings): Compilation {
    assert(settings.rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");

    const rules: RuleCompiled[] = [];
    let skipped = 0;

    if (!settings.enabled) return { rules, skipped };

    for (const rule of settings.rules.filter(entry => entry.enabled)) {
        const compiled = compileRule(rule);

        if (compiled) {
            rules.push(compiled);
        } else {
            skipped += 1;
        }
    }

    const targets = rules.reduce((total, rule) => total + rule.targets.length, 0);

    assert(rules.length + skipped <= settings.rules.length, "every rule either compiles or counts as skipped");
    assert(targets <= DNR_RULES_COUNT_MAX, "the compiled output fits the browser's dynamic rule ceiling");

    return { rules, skipped };
}

function compileRule(rule: Rule): RuleCompiled | null {
    if (rule.protocols.length === 0) return null;
    if (rule.resources.length === 0) return null;

    const candidate = schemeAdd(rule.url);

    if (!URL.canParse(candidate)) return null;

    const { hostname, pathname } = new URL(candidate);

    if (hostname === "") return null;

    const port = rulePort(rule.url);

    const compiled: RuleCompiled = {
        hostname,
        path: pathname,
        port,
        resources: [...rule.resources],
        targets: rule.protocols.map(protocol => ({ port: portCanonical(protocol, port), protocol })),
        url: rule.url,
        wildcard: rule.wildcard,
    };

    assert(compiled.resources.length > 0, "a compiled rule names at least one resource");
    assert(compiled.targets.length === rule.protocols.length, "a compiled rule keeps one target per protocol");

    return compiled;
}

export function matchPatterns(rule: RuleCompiled): string[] {
    assert(rule.targets.length > 0, "a compiled rule names at least one target");

    const paths = rule.path.endsWith("/") ? [rule.path] : [rule.path, `${rule.path}/`];
    const matched = new Set<string>();

    for (const target of rule.targets) {
        for (const path of paths) {
            const base = `${target.protocol}://${rule.hostname}${path}`;

            matched.add(base);

            if (rule.wildcard) matched.add(`${base}*`);
        }
    }

    const patterns = [...matched];

    assert(patterns.length > 0, "a compiled rule yields at least one match pattern");
    assert(patterns.length >= rule.targets.length, "every target contributes a match pattern");

    return patterns;
}

export function portCanonical(protocol: Protocol, port: number | null): number | null {
    if (port === null) return null;

    assert(port >= PORT_MIN, "a compiled port is at least the range floor");
    assert(port <= PORT_MAX, "a compiled port is at most the range ceiling");

    if (port === portDefault(protocol)) return null;

    return port;
}

export function portDefault(scheme: string): number | null {
    const port = PORTS_DEFAULT[scheme.replace(":", "")] ?? null;

    if (port !== null) assert(port >= PORT_MIN, "a scheme default port is at least the range floor");
    if (port !== null) assert(port <= PORT_MAX, "a scheme default port is at most the range ceiling");

    return port;
}

export function portEffective(url: URL): number | null {
    if (url.port === "") return portDefault(url.protocol);

    const port = Number(url.port);

    assert(Number.isInteger(port), "a port the url parser held is an integer");
    assert(port <= PORT_MAX, "a port the url parser held is at most the range ceiling");

    return port;
}

export function portMatches(url: string, expected: number | null): boolean {
    if (expected === null) return true;

    assert(expected >= PORT_MIN, "an expected port is at least the range floor");
    assert(expected <= PORT_MAX, "an expected port is at most the range ceiling");

    if (!URL.canParse(url)) return false;

    return portEffective(new URL(url)) === expected;
}
