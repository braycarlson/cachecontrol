import { SCHEMA, migrate, nonceCreate, settingsCreate, settingsGet, settingsSave, skippedGet, skippedSave } from "../src/storage";
import {
    GROUPS_COUNT_MAX,
    PROTOCOLS_DEFAULT,
    RESOURCES_DEFAULT,
    RULES_COUNT_MAX,
    RULE_GROUP_NAME_LENGTH_MAX,
    RULE_NAME_LENGTH_MAX,
} from "../src/constant";
import { ruleCreate } from "../src/rules";
import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { testBrowser } from "./browser";

const LEGACY_RULE = {
    enabled: true,
    protocols: [],
    resources: [],
    url: "http://localhost:3000",
    wildcard: true,
};

async function read(keys: string[]): Promise<Record<string, unknown>> {
    return testBrowser.storage.local.get(keys);
}

async function seed(values: Record<string, unknown>): Promise<void> {
    await testBrowser.storage.local.set(values);
}

describe("settingsGet", () => {
    it("returns defaults on empty storage", async () => {
        expect(await settingsGet()).toEqual(settingsCreate());
    });

    it("reads the legacy key when the new one is absent", async () => {
        await seed({ urls: [{ url: "example.com" }] });

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["example.com"]);
    });

    it("prefers the new key when both are present", async () => {
        await seed({ rules: [{ url: "new.example" }], urls: [{ url: "old.example" }] });

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["new.example"]);
    });

    it("treats a missing enabled key as on and false as off", async () => {
        expect((await settingsGet()).enabled).toBe(true);

        await seed({ enabled: false });

        expect((await settingsGet()).enabled).toBe(false);
    });
});

describe("parsing a stored rule", () => {
    it("drops entries that are not records", async () => {
        await seed({ rules: ["example.com", 7, null, [], { url: "example.com" }] });

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["example.com"]);
    });

    it("drops entries carrying no url or an empty url", async () => {
        await seed({ rules: [{ enabled: true }, { url: "" }, { url: 7 }, { url: "kept.example" }] });

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["kept.example"]);
    });

    it("defaults enabled and wildcard to true", async () => {
        await seed({ rules: [{ url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.enabled).toBe(true);
        expect(rule?.wildcard).toBe(true);
    });

    it("keeps enabled and wildcard when stored false", async () => {
        await seed({ rules: [{ enabled: false, url: "example.com", wildcard: false }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.enabled).toBe(false);
        expect(rule?.wildcard).toBe(false);
    });

    it("drops unknown members from protocols and resources", async () => {
        await seed({
            rules: [{
                protocols: ["http", "gopher"],
                resources: ["script", "wombat"],
                url: "example.com",
            }],
        });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.protocols).toEqual(["http"]);
        expect(rule?.resources).toEqual(["script"]);
    });

    it("reads an empty stored array as the full default set", async () => {
        await seed({ rules: [LEGACY_RULE] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.protocols).toEqual([...PROTOCOLS_DEFAULT]);
        expect(rule?.resources).toEqual([...RESOURCES_DEFAULT]);
    });

    it("reads the legacy all_resources sentinel as the full default set", async () => {
        await seed({ rules: [{ resources: ["all_resources"], url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.resources).toEqual([...RESOURCES_DEFAULT]);
    });

    it("keeps order and deduplicates by canonical form, first occurrence winning", async () => {
        await seed({
            rules: [
                { url: "http://localhost:3000" },
                { url: "example.com" },
                { url: "LOCALHOST:3000" },
                { url: "https://localhost:3000/" },
            ],
        });

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["http://localhost:3000", "example.com"]);
    });
});

describe("parsing a stored name and group", () => {
    it("reads a missing name and missing group as empty", async () => {
        await seed({ rules: [{ url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.name).toBe("");
        expect(rule?.group).toBe("");
    });

    it("drops a name and a group of the wrong type", async () => {
        await seed({ rules: [{ group: 7, name: 7, url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.name).toBe("");
        expect(rule?.group).toBe("");
    });

    it("trims a name and caps it at the limit", async () => {
        await seed({ rules: [{ name: `  ${"n".repeat(RULE_NAME_LENGTH_MAX + 20)}  `, url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.name).toHaveLength(RULE_NAME_LENGTH_MAX);
    });

    it("trims a group and caps it at the limit", async () => {
        await seed({ rules: [{ group: `  ${"g".repeat(RULE_GROUP_NAME_LENGTH_MAX + 5)}  `, url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.group).toBe("g".repeat(RULE_GROUP_NAME_LENGTH_MAX));
    });

    it("reads the first tag as the group for a rule stored before groups", async () => {
        await seed({ rules: [{ tags: ["Frontend", "Work"], url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.group).toBe("Frontend");
    });

    it("prefers a stored group over the tags beside it", async () => {
        await seed({ rules: [{ group: "Backend", tags: ["Frontend"], url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.group).toBe("Backend");
    });

    it("reads an empty tag list as no group", async () => {
        await seed({ rules: [{ tags: [], url: "example.com" }] });

        const [rule] = (await settingsGet()).rules;

        expect(rule?.group).toBe("");
    });
});

describe("parsing the stored groups", () => {
    it("reads a missing list as the groups the rules carry", async () => {
        await seed({ rules: [{ group: "Work", url: "a.example" }, { group: "Backend", url: "b.example" }] });

        expect((await settingsGet()).groups).toEqual(["Backend", "Work"]);
    });

    it("keeps a group no rule belongs to", async () => {
        await seed({ groups: ["Empty"], rules: [] });

        expect((await settingsGet()).groups).toEqual(["Empty"]);
    });

    it("drops entries that are not strings and trims what is left", async () => {
        await seed({ groups: [7, null, "  Work  ", ""], rules: [] });

        expect((await settingsGet()).groups).toEqual(["Work"]);
    });

    it("holds one spelling of a group, the stored list winning", async () => {
        await seed({ groups: ["Work"], rules: [{ group: "WORK", url: "a.example" }] });

        const settings = await settingsGet();

        expect(settings.groups).toEqual(["Work"]);
        expect(settings.rules[0]?.group).toBe("Work");
    });

    it("takes in a group a rule carries but the list is missing", async () => {
        await seed({ groups: ["Work"], rules: [{ group: "Backend", url: "a.example" }] });

        expect((await settingsGet()).groups).toEqual(["Backend", "Work"]);
    });

    it("leaves an ungrouped rule ungrouped", async () => {
        await seed({ groups: ["Work"], rules: [{ url: "a.example" }] });

        expect((await settingsGet()).rules[0]?.group).toBe("");
    });

    it("caps a group at the limit", async () => {
        await seed({ groups: [`  ${"g".repeat(RULE_GROUP_NAME_LENGTH_MAX + 5)}  `], rules: [] });

        expect((await settingsGet()).groups).toEqual(["g".repeat(RULE_GROUP_NAME_LENGTH_MAX)]);
    });
});

describe("migrate", () => {
    it("converts a legacy shape into working rules", async () => {
        await seed({ urls: [LEGACY_RULE], wildcard: true });

        await migrate();

        const [rule] = (await settingsGet()).rules;

        expect(rule?.url).toBe("http://localhost:3000");
        expect(rule?.protocols).toEqual([...PROTOCOLS_DEFAULT]);
        expect(rule?.resources).toEqual([...RESOURCES_DEFAULT]);
    });

    it("removes the legacy urls and wildcard keys", async () => {
        await seed({ urls: [LEGACY_RULE], wildcard: true });

        await migrate();

        expect(await read(["urls", "wildcard"])).toEqual({});
    });

    it("stamps the schema", async () => {
        await migrate();

        expect(await read(["schema"])).toEqual({ schema: SCHEMA });
    });

    it("seeds the group list from the groups the rules carry", async () => {
        await seed({ rules: [{ group: "Work", url: "a.example" }, { group: "Backend", url: "b.example" }] });

        await migrate();

        expect(await read(["groups"])).toEqual({ groups: ["Backend", "Work"] });
    });

    it("keeps a group list that is already there", async () => {
        await seed({ groups: ["Work"], rules: [] });

        await migrate();

        expect(await read(["groups"])).toEqual({ groups: ["Work"] });
    });

    it("leaves an already migrated store alone", async () => {
        await seed({ rules: [{ url: "example.com" }] });

        await migrate();

        const first = await read(["rules", "schema"]);

        await migrate();

        expect(await read(["rules", "schema"])).toEqual(first);
    });

    it("keeps rules the new key already holds", async () => {
        await seed({ rules: [{ url: "new.example" }], urls: [{ url: "old.example" }] });

        await migrate();

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["new.example"]);
    });

    it("survives two concurrent invocations", async () => {
        await seed({ urls: [LEGACY_RULE], wildcard: true });

        await Promise.all([migrate(), migrate()]);

        const settings = await settingsGet();

        expect(settings.rules.map(rule => rule.url)).toEqual(["http://localhost:3000"]);
        expect(await read(["urls", "wildcard"])).toEqual({});
    });
});

describe("settingsSave", () => {
    it("round-trips through settingsGet unchanged", async () => {
        const settings = {
            enabled: false,
            groups: ["Frontend"],
            rules: [
                {
                    enabled: false,
                    group: "Frontend",
                    name: "Local React",
                    protocols: ["http" as const],
                    resources: ["script" as const, "image" as const],
                    url: "localhost:3000",
                    wildcard: false,
                },
            ],
        };

        await settingsSave(settings);

        expect(await settingsGet()).toEqual(settings);
    });

    it("stamps the schema", async () => {
        await settingsSave(settingsCreate());

        expect(await read(["schema"])).toEqual({ schema: SCHEMA });
    });

    it("writes the nonce it was handed", async () => {
        await settingsSave(settingsCreate(), "given");

        expect(await read(["nonce"])).toEqual({ nonce: "given" });
    });

    it("writes a fresh nonce when handed none", async () => {
        await settingsSave(settingsCreate());

        const first = await read(["nonce"]);

        await settingsSave(settingsCreate());

        expect(await read(["nonce"])).not.toEqual(first);
    });

    it("hands the browser a payload it can clone, whatever reactivity wrapped the rules", async () => {
        const source = reactive({
            enabled: true,
            groups: ["Frontend"],
            rules: [
                {
                    enabled: true,
                    group: "Frontend",
                    name: "Local React",
                    protocols: ["http" as const],
                    resources: ["script" as const],
                    url: "localhost:3000",
                    wildcard: true,
                },
            ],
        });

        const set = vi.spyOn(testBrowser.storage.local, "set");

        await settingsSave({
            enabled: source.enabled,
            groups: source.groups,
            rules: source.rules.filter(rule => rule.url !== "deleted.example"),
        });

        const [payload] = set.mock.calls.at(-1) ?? [];

        expect(() => structuredClone(payload)).not.toThrow();

        set.mockRestore();
    });
});

describe("the skipped count", () => {
    it("reads as zero when nothing wrote one", async () => {
        expect(await skippedGet()).toBe(0);
    });

    it("reads as zero when the stored value is not a number", async () => {
        await seed({ skipped: "two" });

        expect(await skippedGet()).toBe(0);
    });

    it("round-trips a count", async () => {
        await skippedSave(3);

        expect(await skippedGet()).toBe(3);
    });

    it("writes nothing when the count has not moved", async () => {
        await skippedSave(0);

        expect(await read(["skipped"])).toEqual({});
    });

    it("reads as zero when the stored value is negative or fractional", async () => {
        await seed({ skipped: -1 });

        expect(await skippedGet()).toBe(0);

        await seed({ skipped: 1.5 });

        expect(await skippedGet()).toBe(0);
    });

    it("crashes on a count that is negative or fractional", async () => {
        await expect(skippedSave(-1)).rejects.toThrow("assert:");
        await expect(skippedSave(1.5)).rejects.toThrow("assert:");
    });
});

describe("the count maxima", () => {
    it("drops the rules past the maximum when storage holds too many", async () => {
        const rules = Array.from({ length: RULES_COUNT_MAX + 10 }, (_, index) => ({ url: `host${index}.example` }));

        await seed({ rules });

        expect((await settingsGet()).rules).toHaveLength(RULES_COUNT_MAX);
    });

    it("drops the groups past the maximum when storage holds too many", async () => {
        const groups = Array.from({ length: GROUPS_COUNT_MAX + 10 }, (_, index) => `Group ${index}`);

        await seed({ groups, rules: [] });

        expect((await settingsGet()).groups).toHaveLength(GROUPS_COUNT_MAX);
    });

    it("crashes rather than saving more rules than the maximum", async () => {
        const rules = Array.from({ length: RULES_COUNT_MAX + 1 }, (_, index) => ruleCreate(`host${index}.example`));

        await expect(settingsSave({ enabled: true, groups: [], rules })).rejects.toThrow("assert:");
    });

    it("crashes rather than saving more groups than the maximum", async () => {
        const groups = Array.from({ length: GROUPS_COUNT_MAX + 1 }, (_, index) => `Group ${index}`);

        await expect(settingsSave({ enabled: true, groups, rules: [] })).rejects.toThrow("assert:");
    });

    it("crashes rather than saving a rule name past its length maximum", async () => {
        const rule = { ...ruleCreate("example.com"), name: "n".repeat(RULE_NAME_LENGTH_MAX + 1) };

        await expect(settingsSave({ enabled: true, groups: [], rules: [rule] })).rejects.toThrow("assert:");
    });

    it("saves a full rule list", async () => {
        const rules = Array.from({ length: RULES_COUNT_MAX }, (_, index) => ruleCreate(`host${index}.example`));

        await settingsSave({ enabled: true, groups: [], rules });

        expect((await settingsGet()).rules).toHaveLength(RULES_COUNT_MAX);
    });
});

describe("nonceCreate", () => {
    it("issues a unique value across rapid calls", () => {
        const issued = Array.from({ length: 64 }, () => nonceCreate());

        expect(new Set(issued).size).toBe(issued.length);
    });
});
