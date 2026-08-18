import browser from "webextension-polyfill";
import { assert } from "./assert";
import { canonical, groupsMerge } from "./rules";
import {
    GROUPS_COUNT_MAX,
    PROTOCOLS_DEFAULT,
    RESOURCES_DEFAULT,
    RULES_COUNT_MAX,
    RULE_GROUP_NAME_LENGTH_MAX,
    RULE_NAME_LENGTH_MAX,
} from "./constant";
import type { Protocol, ResourceType } from "./constant";

const GROUP_KEY_LEGACY = "tags";

const NONCE_PREFIX_LENGTH = 2;

const NONCE_RADIX = 36;

const RULES_KEY_LEGACY = "urls";

const SKIPPED_KEY = "skipped";

const WILDCARD_KEY_LEGACY = "wildcard";

export const SCHEMA = 3;

let sequence = 0;

export interface Rule {
    enabled: boolean;
    group: string;
    name: string;
    protocols: Protocol[];
    resources: ResourceType[];
    url: string;
    wildcard: boolean;
}

export interface Settings {
    enabled: boolean;
    groups: string[];
    rules: Rule[];
}

function groupParse(value: unknown): string {
    const source = isArray(value) ? value[0] : value;

    if (typeof source !== "string") return "";

    const group = source.trim().slice(0, RULE_GROUP_NAME_LENGTH_MAX);

    assert(group.length <= RULE_GROUP_NAME_LENGTH_MAX, "a parsed group name is within its length maximum");
    assert(!group.startsWith(" "), "a parsed group name carries no leading space");

    return group;
}

function groupsParse(value: unknown, rules: readonly Rule[]): string[] {
    const stored = isArray(value) ? value.map(groupParse) : [];
    const groups = groupsMerge(stored, rules);

    assert(groups.length <= GROUPS_COUNT_MAX, "a parsed group list is within its count maximum");
    assert(groups.every(group => group !== ""), "a parsed group list holds no empty name");

    return groups;
}

function isArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null;
}

function membersParse<T extends string>(value: unknown, allowed: readonly T[]): T[] {
    assert(allowed.length > 0, "the allowed member set is not empty");

    if (!isArray(value)) return [...allowed];

    const members = allowed.filter(member => value.includes(member));

    assert(members.length <= allowed.length, "a parsed member list is a subset of the allowed set");

    if (members.length === 0) return [...allowed];

    return members;
}

export async function migrate(): Promise<void> {
    const stored = await browser.storage.local.get([
        "groups",
        "rules",
        "schema",
        RULES_KEY_LEGACY,
        WILDCARD_KEY_LEGACY,
    ]);

    const legacy = stored[RULES_KEY_LEGACY] !== undefined || stored[WILDCARD_KEY_LEGACY] !== undefined;

    if (!legacy && stored["schema"] === SCHEMA) return;

    const rules = rulesParse(stored["rules"] ?? stored[RULES_KEY_LEGACY]);

    assert(rules.length <= RULES_COUNT_MAX, "a migrated rule list is within its count maximum");

    if (legacy && stored["rules"] === undefined) {
        await browser.storage.local.set({ rules });
    }

    if (stored["groups"] === undefined) {
        await browser.storage.local.set({ groups: groupsParse(undefined, rules) });
    }

    await browser.storage.local.set({ schema: SCHEMA });

    const written = await browser.storage.local.get("schema");

    assert(written["schema"] === SCHEMA, "the migration stamped the schema it wrote");

    if (legacy) await browser.storage.local.remove([RULES_KEY_LEGACY, WILDCARD_KEY_LEGACY]);
}

function nameParse(value: unknown): string {
    if (typeof value !== "string") return "";

    const name = value.trim().slice(0, RULE_NAME_LENGTH_MAX);

    assert(name.length <= RULE_NAME_LENGTH_MAX, "a parsed rule name is within its length maximum");

    return name;
}

export function nonceCreate(): string {
    const previous = sequence;

    sequence += 1;

    assert(sequence > previous, "the nonce sequence only ever climbs");
    assert(Number.isSafeInteger(sequence), "the nonce sequence stays a safe integer");

    const suffix = Math.random().toString(NONCE_RADIX).slice(NONCE_PREFIX_LENGTH);
    const nonce = `${sequence}.${suffix}`;

    assert(nonce !== "", "a nonce carries a value");

    return nonce;
}

function ruleParse(value: unknown): Rule | null {
    if (!isRecord(value)) return null;

    const { url } = value;

    if (typeof url !== "string") return null;
    if (url === "") return null;

    const rule: Rule = {
        enabled: value["enabled"] !== false,
        group: groupParse(value["group"] ?? value[GROUP_KEY_LEGACY]),
        name: nameParse(value["name"]),
        protocols: membersParse(value["protocols"], PROTOCOLS_DEFAULT),
        resources: membersParse(value["resources"], RESOURCES_DEFAULT),
        url,
        wildcard: value["wildcard"] !== false,
    };

    assert(rule.url !== "", "a parsed rule carries a url");
    assert(rule.protocols.length > 0, "a parsed rule names at least one protocol");
    assert(rule.resources.length > 0, "a parsed rule names at least one resource");

    return rule;
}

function rulePlain(rule: Rule): Rule {
    assert(rule.url !== "", "a stored rule carries a url");
    assert(rule.name.length <= RULE_NAME_LENGTH_MAX, "a stored rule name is within its length maximum");
    assert(rule.group.length <= RULE_GROUP_NAME_LENGTH_MAX, "a stored group name is within its length maximum");

    return {
        enabled: rule.enabled,
        group: rule.group,
        name: rule.name,
        protocols: [...rule.protocols],
        resources: [...rule.resources],
        url: rule.url,
        wildcard: rule.wildcard,
    };
}

function rulesAlign(rules: Rule[], groups: readonly string[]): Rule[] {
    assert(rules.length <= RULES_COUNT_MAX, "the rule list is within its count maximum");
    assert(groups.length <= GROUPS_COUNT_MAX, "the group list is within its count maximum");

    const known = new Map(groups.map(group => [group.toLowerCase(), group]));

    for (const rule of rules) {
        const group = known.get(rule.group.toLowerCase());

        if (group !== undefined) rule.group = group;
    }

    return rules;
}

function rulesParse(value: unknown): Rule[] {
    if (!isArray(value)) return [];

    const parsed = value.map(entry => ruleParse(entry)).filter(rule => rule !== null);
    const rules: Rule[] = [];
    const seen = new Set<string>();

    for (const rule of parsed) {
        const key = canonical(rule.url);

        if (!seen.has(key)) {
            seen.add(key);
            rules.push(rule);
        }
    }

    const kept = rules.slice(0, RULES_COUNT_MAX);

    assert(seen.size === rules.length, "each kept rule canonicalizes to a key of its own");
    assert(kept.length <= RULES_COUNT_MAX, "a parsed rule list is within its count maximum");

    return kept;
}

export function settingsCreate(): Settings {
    return {
        enabled: true,
        groups: [],
        rules: [],
    };
}

export async function settingsGet(): Promise<Settings> {
    const stored = await browser.storage.local.get(["enabled", "groups", "rules", RULES_KEY_LEGACY]);

    const rules = rulesParse(stored["rules"] ?? stored[RULES_KEY_LEGACY]);
    const groups = groupsParse(stored["groups"], rules);

    assert(rules.length <= RULES_COUNT_MAX, "a parsed rule list is within its count maximum");
    assert(groups.length <= GROUPS_COUNT_MAX, "a parsed group list is within its count maximum");

    return {
        enabled: stored["enabled"] !== false,
        groups,
        rules: rulesAlign(rules, groups),
    };
}

export async function settingsSave(settings: Settings, nonce = nonceCreate()): Promise<void> {
    assert(settings.rules.length <= RULES_COUNT_MAX, "a saved rule list is within its count maximum");
    assert(settings.groups.length <= GROUPS_COUNT_MAX, "a saved group list is within its count maximum");
    assert(nonce !== "", "a save carries a nonce");

    const rules = settings.rules.map(rulePlain);

    assert(rules.length === settings.rules.length, "a save keeps every rule it was handed");

    await browser.storage.local.set({
        enabled: settings.enabled,
        groups: [...settings.groups],
        nonce,
        rules,
        schema: SCHEMA,
    });
}

export async function skippedGet(): Promise<number> {
    const stored = await browser.storage.local.get(SKIPPED_KEY);
    const skipped = skippedParse(stored[SKIPPED_KEY]);

    assert(Number.isInteger(skipped), "a parsed skipped count is an integer");
    assert(skipped >= 0, "a parsed skipped count is not negative");

    return skipped;
}

function skippedParse(value: unknown): number {
    if (typeof value !== "number") return 0;
    if (!Number.isInteger(value)) return 0;
    if (value < 0) return 0;

    return value;
}

export async function skippedSave(skipped: number): Promise<void> {
    assert(Number.isInteger(skipped), "a skipped count is an integer");
    assert(skipped >= 0, "a skipped count is not negative");

    if (await skippedGet() === skipped) return;

    await browser.storage.local.set({ [SKIPPED_KEY]: skipped });
}
