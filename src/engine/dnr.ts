import browser from "webextension-polyfill";
import { assert } from "../assert";
import { compile } from "./compile";
import { diagnosticSave, errorDescribe } from "../diagnostic";
import { DNR_RULES_COUNT_MAX, HEADERS_CACHE_DISABLED, PORT_MIN, REGEX_CHECKS_CONCURRENT_MAX } from "../constant";
import { settingsGet } from "../storage";
import type { DeclarativeNetRequest } from "webextension-polyfill";
import type { ResourceType } from "../constant";
import type { RuleCompiled, TargetCompiled } from "./compile";

interface Candidate {
    regex: string;
    resources: ResourceType[];
    url: string;
}

interface CandidateChecked {
    regex: string;
    resources: ResourceType[];
    supported: boolean;
    url: string;
}

const HEADERS_REQUEST: DeclarativeNetRequest.RuleActionRequestHeadersItemType[] = [
    { header: "Cache-Control", operation: "set", value: HEADERS_CACHE_DISABLED["Cache-Control"] },
    { header: "Pragma", operation: "set", value: HEADERS_CACHE_DISABLED.Pragma },
];

const HEADERS_RESPONSE: DeclarativeNetRequest.RuleActionResponseHeadersItemType[] = Object
    .entries(HEADERS_CACHE_DISABLED)
    .map(([header, value]) => ({ header, operation: "set" as const, value }));

const REGEX_RESERVED = /[$()*+.?[\\\]^{|}]/gu;

let generation = 0;

function candidateChunks(candidates: readonly Candidate[]): Candidate[][] {
    const chunks: Candidate[][] = [];

    for (let start = 0; start < candidates.length; start += REGEX_CHECKS_CONCURRENT_MAX) {
        chunks.push(candidates.slice(start, start + REGEX_CHECKS_CONCURRENT_MAX));
    }

    assert(
        chunks.length * REGEX_CHECKS_CONCURRENT_MAX >= candidates.length,
        "every candidate lands in a chunk",
    );
    assert(
        chunks.every(chunk => chunk.length <= REGEX_CHECKS_CONCURRENT_MAX),
        "no chunk runs wider than the concurrency bound",
    );

    return chunks;
}

async function candidatesCheck(candidates: readonly Candidate[]): Promise<CandidateChecked[]> {
    assert(candidates.length <= DNR_RULES_COUNT_MAX, "the candidate set fits the browser's dynamic rule ceiling");

    const chunks = candidateChunks(candidates);

    const checked = await chunks.reduce(
        async (settled: Promise<CandidateChecked[]>, chunk) => [...await settled, ...await candidatesCheckChunk(chunk)],
        Promise.resolve<CandidateChecked[]>([]),
    );

    assert(checked.length === candidates.length, "every candidate comes back checked");

    return checked;
}

async function candidatesCheckChunk(chunk: readonly Candidate[]): Promise<CandidateChecked[]> {
    assert(chunk.length <= REGEX_CHECKS_CONCURRENT_MAX, "a chunk runs no wider than the concurrency bound");

    const checked = await Promise.all(chunk.map(async candidate => ({
        ...candidate,
        supported: await regexIsSupported(candidate.regex),
    })));

    assert(checked.length === chunk.length, "every candidate in a chunk comes back checked");

    return checked;
}

function candidatesOf(rules: readonly RuleCompiled[]): Candidate[] {
    const candidates = rules.flatMap(
        rule => rule.targets.map(target => ({
            regex: regexFilter(rule, target),
            resources: rule.resources,
            url: rule.url,
        })),
    );

    assert(candidates.length >= rules.length, "every compiled rule contributes a candidate");
    assert(candidates.length <= DNR_RULES_COUNT_MAX, "the candidate set fits the browser's dynamic rule ceiling");

    return candidates;
}

function dynamicRule(candidate: CandidateChecked, id: number): DeclarativeNetRequest.Rule {
    assert(id > 0, "a dynamic rule numbers from one");
    assert(candidate.resources.length > 0, "a dynamic rule names at least one resource type");

    return {
        action: {
            requestHeaders: HEADERS_REQUEST,
            responseHeaders: HEADERS_RESPONSE,
            type: "modifyHeaders",
        },
        condition: {
            regexFilter: candidate.regex,
            resourceTypes: [...candidate.resources],
        },
        id,
    };
}

function portPattern(rule: RuleCompiled, target: TargetCompiled): string {
    if (rule.port === null) return "(?::\\d+)?";

    assert(rule.port >= PORT_MIN, "a compiled port is at least the range floor");

    if (target.port === null) return "";

    assert(target.port === rule.port, "a target names the port the rule names");

    return `:${target.port}`;
}

function regexEscape(value: string): string {
    return value.replace(REGEX_RESERVED, "\\$&");
}

export function regexFilter(rule: RuleCompiled, target: TargetCompiled): string {
    assert(rule.hostname !== "", "a compiled rule carries a hostname");

    const prefix = `^${target.protocol}://${regexEscape(rule.hostname)}${portPattern(rule, target)}${regexEscape(rule.path)}`;

    assert(prefix.startsWith("^"), "a regex filter is anchored at the start");

    if (rule.wildcard) return prefix;
    if (rule.path.endsWith("/")) return `${prefix}$`;

    return `${prefix}/?$`;
}

async function regexIsSupported(regex: string): Promise<boolean> {
    assert(regex !== "", "a candidate carries a regex");

    const result = await browser.declarativeNetRequest.isRegexSupported({ regex });

    return result.isSupported;
}

async function rulesWrite(
    addRules: readonly DeclarativeNetRequest.Rule[],
    removeRuleIds: readonly number[],
): Promise<boolean> {
    assert(addRules.length <= DNR_RULES_COUNT_MAX, "the written set fits the browser's dynamic rule ceiling");
    assert(removeRuleIds.every(id => id > 0), "every removed rule carries a positive id");

    try {
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: [...addRules],
            removeRuleIds: [...removeRuleIds],
        });
    } catch (cause) {
        await diagnosticSave(`The browser refused the rule set. ${errorDescribe(cause)}`);

        return false;
    }

    return true;
}

export async function sync(): Promise<number | null> {
    const current = generation + 1;

    generation = current;

    assert(current > 0, "a sync generation numbers from one");

    const settings = await settingsGet();

    if (generation !== current) return null;

    const { rules, skipped } = compile(settings);
    const checked = await candidatesCheck(candidatesOf(rules));

    if (generation !== current) return null;

    const addRules: DeclarativeNetRequest.Rule[] = [];
    const rejected = new Set<string>();

    for (const candidate of checked) {
        if (candidate.supported) {
            addRules.push(dynamicRule(candidate, addRules.length + 1));
        } else {
            rejected.add(candidate.url);
        }
    }

    const rulesExisting = await browser.declarativeNetRequest.getDynamicRules();

    if (generation !== current) return null;

    assert(addRules.length <= DNR_RULES_COUNT_MAX, "the submitted set fits the browser's dynamic rule ceiling");
    assert(addRules.length + rejected.size <= checked.length, "every candidate is either submitted or rejected");

    if (!await rulesWrite(addRules, rulesExisting.map(rule => rule.id))) return null;

    return skipped + rejected.size;
}
