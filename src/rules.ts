import { assert } from "./assert";
import {
    GROUPS_COUNT_MAX,
    HOSTS_PRESET,
    PORT_MAX,
    PORT_MIN,
    PROTOCOLS_DEFAULT,
    RESOURCES_DEFAULT,
    RULES_COUNT_MAX,
} from "./constant";
import type { Rule } from "./storage";

const LABEL_PATTERN = "[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?";

const HOSTNAME_PATTERN = new RegExp(`^(\\[[0-9a-f:.]+\\]|${LABEL_PATTERN}(\\.${LABEL_PATTERN})*)$`, "iu");

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//iu;

const SCHEMES_MATCHABLE = ["http:", "https:"];

export function canonical(url: string): string {
    const trimmed = url.trim();
    const candidate = schemeAdd(trimmed);

    if (!URL.canParse(candidate)) return trimmed;

    const { hostname, pathname } = new URL(candidate);
    const port = rulePort(trimmed);
    const path = pathname === "/" ? "" : pathname;

    if (path !== "") assert(path.startsWith("/"), "a canonical path is rooted");

    const result = port === null ? `${hostname}${path}` : `${hostname}:${port}${path}`;

    assert(result === result.trim(), "a canonical url carries no outer whitespace");
    assert(rulePort(result) === port, "a canonical url names the port it was compiled from");

    return result;
}

export function groupCount(rules: readonly Rule[], group: string): number {
    assert(rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");

    const target = group.toLowerCase();
    const count = rules.filter(rule => rule.group.toLowerCase() === target).length;

    assert(count <= rules.length, "a group holds no more rules than the list carries");

    return count;
}

export function groupError(name: string, groups: readonly string[], current = ""): string {
    assert(groups.length <= GROUPS_COUNT_MAX, "the group list is within its count maximum");

    const trimmed = name.trim();

    if (!trimmed) return "Enter a group name.";

    const target = trimmed.toLowerCase();

    if (target === current.trim().toLowerCase()) return "";
    if (groups.some(group => group.toLowerCase() === target)) return "A group with this name already exists.";

    if (current.trim() === "") {
        if (groups.length >= GROUPS_COUNT_MAX) {
            return `CacheControl holds ${GROUPS_COUNT_MAX} groups at most, so delete one before adding another.`;
        }
    }

    assert(target !== "", "a group name that passed every check is not empty");

    return "";
}

export function groupsMerge(groups: readonly string[], rules: readonly Rule[]): string[] {
    assert(rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");

    const merged = new Map<string, string>();

    for (const group of [...groups, ...ruleGroups(rules)]) {
        const key = group.toLowerCase();

        if (key !== "") {
            if (!merged.has(key)) merged.set(key, group);
        }
    }

    const kept = groupsSort([...merged.values()]).slice(0, GROUPS_COUNT_MAX);

    assert(kept.length <= GROUPS_COUNT_MAX, "the merged group list is within its count maximum");

    return kept;
}

export function groupsSort(groups: readonly string[]): string[] {
    const sorted = [...groups].sort((left, right) => left.localeCompare(right));

    assert(sorted.length === groups.length, "sorting keeps every group");

    return sorted;
}

export function isMatchable(url: string): boolean {
    const candidate = schemeAdd(url.trim());

    if (!URL.canParse(candidate)) return false;

    const { hostname, protocol } = new URL(candidate);

    assert(protocol.endsWith(":"), "a parsed protocol carries its trailing colon");

    if (!SCHEMES_MATCHABLE.includes(protocol)) return false;

    assert(hostname === hostname.toLowerCase(), "a parsed http hostname comes back lowercase");

    return HOSTNAME_PATTERN.test(hostname);
}

export function presetUrls(port: number): string[] {
    assert(Number.isInteger(port), "a preset port is an integer");
    assert(port >= PORT_MIN, "a preset port is at least the range floor");
    assert(port <= PORT_MAX, "a preset port is at most the range ceiling");

    const urls = HOSTS_PRESET.map(host => `http://${host}:${port}`);

    assert(urls.length === HOSTS_PRESET.length, "a preset covers every preset host");

    return urls;
}

export function ruleCreate(url: string): Rule {
    assert(url.trim() !== "", "a new rule needs a url");

    const rule: Rule = {
        enabled: true,
        group: "",
        name: "",
        protocols: [...PROTOCOLS_DEFAULT],
        resources: [...RESOURCES_DEFAULT],
        url: canonical(url),
        wildcard: true,
    };

    assert(rule.url !== "", "a new rule carries a canonical url");
    assert(canonical(rule.url) === rule.url, "a new rule stores a url that is already canonical");

    return rule;
}

export function ruleError(url: string, rules: readonly Rule[]): string {
    assert(rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");

    const trimmed = url.trim();

    if (!trimmed) return "Enter a URL.";
    if (!isMatchable(trimmed)) return "That is not a URL a rule can match.";

    const target = canonical(trimmed);

    assert(target !== "", "a matchable url canonicalizes to something");

    if (rules.some(rule => canonical(rule.url) === target)) return "A rule for this URL already exists.";

    if (rules.length >= RULES_COUNT_MAX) {
        return `CacheControl holds ${RULES_COUNT_MAX} rules at most, so delete one before adding another.`;
    }

    return "";
}

export function ruleFind(rules: readonly Rule[], host: string): Rule | undefined {
    assert(rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");

    if (!host) return undefined;

    const target = canonical(host);

    assert(canonical(target) === target, "a canonical host re-canonicalizes to itself");

    return rules.find(rule => canonical(rule.url) === target);
}

export function ruleGroups(rules: readonly Rule[]): string[] {
    assert(rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");

    const groups = new Map<string, string>();

    for (const rule of rules) {
        const key = rule.group.toLowerCase();

        if (key !== "") {
            if (!groups.has(key)) groups.set(key, rule.group);
        }
    }

    const sorted = groupsSort([...groups.values()]);

    assert(sorted.length <= rules.length, "the rules carry no more groups than there are rules");

    return sorted;
}

export function rulePort(url: string): number | null {
    const authority = schemeDrop(url.trim());

    if (!URL.canParse(`http://${authority}`)) return null;

    assert(URL.canParse(`https://${authority}`), "an authority that parses under http parses under https");

    const text = new URL(`http://${authority}`).port || new URL(`https://${authority}`).port;

    if (text === "") return null;

    const port = Number(text);

    assert(Number.isInteger(port), "a port the url parser accepted is an integer");
    assert(port >= PORT_MIN, "a port is at least the range floor");
    assert(port <= PORT_MAX, "a port is at most the range ceiling");

    return port;
}

export function schemeAdd(url: string): string {
    if (SCHEME_PATTERN.test(url)) return url;

    return `https://${url}`;
}

function schemeDrop(url: string): string {
    assert(url === url.trim(), "schemeDrop takes a url with no outer whitespace");

    const scheme = SCHEME_PATTERN.exec(url)?.[0];

    if (scheme === undefined) return url;

    const authority = url.slice(scheme.length);

    assert(authority.length < url.length, "dropping a scheme shortens the url");

    return authority;
}
