import Options from "../../src/options/Options.vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, ruleBuild, settingsSeed } from "../helpers";
import { diagnosticGet, diagnosticSave } from "../../src/diagnostic";
import { mount } from "@vue/test-utils";
import { RULES_COUNT_MAX } from "../../src/constant";
import { testBrowser } from "../browser";
import { useToast } from "../../src/composables/toast";
import type { Rule } from "../../src/storage";

type Wrapper = ReturnType<typeof mount<typeof Options>>;

const { toasts } = useToast();

async function choose(selector: string, value: string): Promise<void> {
    const target = document.querySelector<HTMLSelectElement>(selector);

    if (!target) throw new Error(`No select is at ${selector}.`);

    target.value = value;
    target.dispatchEvent(new Event("change"));

    await flush();
}

async function fill(selector: string, value: string): Promise<void> {
    const input = document.querySelector<HTMLInputElement>(selector);

    if (!input) throw new Error(`No field is at ${selector}.`);

    input.value = value;
    input.dispatchEvent(new Event("input"));

    await flush();
}

async function open(rules: Rule[] = [], enabled = true, groups: string[] = []): Promise<Wrapper> {
    await settingsSeed(rules, enabled, groups);

    const wrapper = mount(Options, { attachTo: document.body });

    await flush();
    await wrapper.vm.$nextTick();

    return wrapper;
}

async function press(wrapper: Wrapper, text: string): Promise<void> {
    const target = wrapper.findAll("button").find(node => node.text() === text);

    if (!target) throw new Error(`No button reads ${text}.`);

    await target.trigger("click");
    await flush();
}

async function pressDialog(wrapper: Wrapper, text: string): Promise<void> {
    const target = [...document.querySelectorAll("[role=\"dialog\"] button")]
        .find(node => node.textContent.trim() === text);

    if (!target) throw new Error(`No dialog button reads ${text}.`);

    (target as HTMLButtonElement).click();

    await flush();
    await wrapper.vm.$nextTick();
}

async function section(wrapper: Wrapper, label: string): Promise<void> {
    await press(wrapper, label);
}

async function stored(): Promise<{ enabled: unknown; groups: string[]; rules: Rule[] }> {
    const values = await testBrowser.storage.local.get(["enabled", "groups", "rules"]);

    return {
        enabled: values["enabled"],
        groups: (values["groups"] ?? []) as string[],
        rules: (values["rules"] ?? []) as Rule[],
    };
}

function transfer(): DataTransfer {
    const held = new Map<string, string>();

    return {
        dropEffect: "none",
        effectAllowed: "none",
        getData: (format: string): string => held.get(format) ?? "",
        setData: (format: string, value: string): void => {
            held.set(format, value);
        },
        setDragImage: (): void => undefined,
    } as unknown as DataTransfer;
}

beforeEach(() => {
    toasts.value = [];

    vi.spyOn(testBrowser.runtime, "getManifest").mockReturnValue({
        manifest_version: 2,
        name: "CacheControl",
        version: "1.0.0",
    });
});

afterEach(() => {
    document.body.innerHTML = "";

    vi.restoreAllMocks();
});

describe("Options", () => {
    it("opens on the general section", async () => {
        const wrapper = await open();

        expect(wrapper.text()).toContain("Enable CacheControl");
    });

    it("writes the global toggle through to storage", async () => {
        const wrapper = await open();

        await wrapper.get("[role=\"switch\"]").trigger("click");
        await flush();

        expect((await stored()).enabled).toBe(false);
    });

    it("switches between sections", async () => {
        const wrapper = await open();

        await section(wrapper, "Presets");

        expect(wrapper.text()).toContain("Each preset covers one development server port");

        await section(wrapper, "About");

        expect(wrapper.text()).toContain("An extension that disables the browser cache");
    });

    it("adds a rule in its canonical form and says so", async () => {
        const wrapper = await open();

        await section(wrapper, "Rules");
        await wrapper.get("#rules-url").setValue("HTTP://LOCALHOST:3000");
        await press(wrapper, "Add rule");

        expect((await stored()).rules.map(rule => rule.url)).toEqual(["localhost:3000"]);
        expect(toasts.value.map(toast => toast.message)).toEqual(["Rule added"]);
    });

    it("keeps a rule out when the url does not validate", async () => {
        const wrapper = await open();

        await section(wrapper, "Rules");
        await wrapper.get("#rules-url").setValue("chrome://settings");
        await press(wrapper, "Add rule");

        expect((await stored()).rules).toEqual([]);
        expect(wrapper.get("#rules-url-error").text()).toBe("That is not a URL a rule can match.");
    });

    it("writes a rule toggle through to storage", async () => {
        const wrapper = await open([ruleBuild("a.example")]);

        await section(wrapper, "Rules");
        await wrapper.get("[aria-label=\"Enable the rule for a.example\"]").trigger("click");
        await flush();

        expect((await stored()).rules[0]?.enabled).toBe(false);
    });

    it("deletes a rule only after the confirm", async () => {
        const wrapper = await open([ruleBuild("a.example"), ruleBuild("b.example")]);

        await section(wrapper, "Rules");
        await wrapper.get("[aria-label=\"Delete the rule for a.example\"]").trigger("click");

        expect((await stored()).rules).toHaveLength(2);

        await pressDialog(wrapper, "Delete rule");

        expect((await stored()).rules.map(rule => rule.url)).toEqual(["b.example"]);
        expect(toasts.value.map(toast => toast.message)).toContain("Rule deleted");
    });

    it("writes a deletion the browser can clone", async () => {
        const wrapper = await open([ruleBuild("a.example"), ruleBuild("b.example")]);

        await section(wrapper, "Rules");

        const set = vi.spyOn(testBrowser.storage.local, "set");

        await wrapper.get("[aria-label=\"Delete the rule for a.example\"]").trigger("click");
        await pressDialog(wrapper, "Delete rule");

        const [payload] = set.mock.calls.at(-1) ?? [];

        expect(() => structuredClone(payload)).not.toThrow();
    });

    it("saves what the rule modal drafts", async () => {
        const wrapper = await open([ruleBuild("a.example")]);

        await section(wrapper, "Rules");
        await wrapper.get("[aria-label=\"Edit the rule for a.example\"]").trigger("click");
        await wrapper.vm.$nextTick();

        const protocol = [...document.querySelectorAll("label")].find(node => node.textContent.trim() === "HTTPS");

        protocol?.querySelector("input")?.click();

        await wrapper.vm.$nextTick();

        const save = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === "Save");

        save?.click();

        await flush();

        expect((await stored()).rules[0]?.protocols).toEqual(["http"]);
        expect(toasts.value.map(toast => toast.message)).toContain("Rule saved");
    });

    it("saves the name and the group the rule modal drafts", async () => {
        const wrapper = await open([ruleBuild("a.example", { group: "Work" }), ruleBuild("b.example")]);

        await section(wrapper, "Rules");
        await wrapper.get("[aria-label=\"Edit the rule for b.example\"]").trigger("click");
        await wrapper.vm.$nextTick();

        await fill("#rule-name", "Staging API");
        await choose("#rule-group", "Work");

        const save = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === "Save");

        save?.click();

        await flush();

        const rule = (await stored()).rules.find(candidate => candidate.url === "b.example");

        expect(rule?.name).toBe("Staging API");
        expect(rule?.group).toBe("Work");
    });

    it("adds a group and offers it to the rule modal", async () => {
        const wrapper = await open([ruleBuild("a.example")]);

        await section(wrapper, "Groups");
        await wrapper.get("#groups-name").setValue("Work");
        await press(wrapper, "Add group");

        expect((await stored()).groups).toEqual(["Work"]);
        expect(toasts.value.map(toast => toast.message)).toContain("Group added");

        await section(wrapper, "Rules");
        await wrapper.get("[aria-label=\"Edit the rule for a.example\"]").trigger("click");
        await wrapper.vm.$nextTick();

        const options = [...document.querySelectorAll<HTMLSelectElement>("#rule-group")[0]?.options ?? []];

        expect(options.map(node => node.textContent.trim())).toEqual(["No group", "Work"]);
    });

    it("moves a rule into the group it was dragged onto", async () => {
        const wrapper = await open([ruleBuild("a.example"), ruleBuild("b.example")], true, ["Work"]);

        await section(wrapper, "Rules");

        await wrapper.get("[title=\"Drag a.example into a group\"]").trigger("dragstart", { dataTransfer: transfer() });
        await wrapper.get("[data-section=\"Work\"]").trigger("dragover", { dataTransfer: transfer() });
        await wrapper.get("[data-section=\"Work\"]").trigger("drop", { dataTransfer: transfer() });
        await flush();

        const { rules } = await stored();

        expect(rules.find(rule => rule.url === "a.example")?.group).toBe("Work");
        expect(toasts.value.map(toast => toast.message)).toContain("Moved to Work");
    });

    it("puts several rules in a group from the groups section at once", async () => {
        const wrapper = await open([
            ruleBuild("a.example"),
            ruleBuild("b.example"),
            ruleBuild("c.example", { group: "Work" }),
        ]);

        await section(wrapper, "Groups");
        await wrapper.get("[aria-label=\"Choose the rules in Work\"]").trigger("click");
        await wrapper.vm.$nextTick();

        for (const url of ["a.example", "b.example"]) {
            const box = [...document.querySelectorAll("label")].find(node => node.textContent.trim() === url);

            box?.querySelector("input")?.click();
        }

        await wrapper.vm.$nextTick();
        await pressDialog(wrapper, "Save");

        expect((await stored()).rules.map(rule => rule.group)).toEqual(["Work", "Work", "Work"]);
        expect(toasts.value.map(toast => toast.message)).toContain("Work updated");
    });

    it("takes a rule out of a group when it is unchecked", async () => {
        const wrapper = await open([ruleBuild("a.example", { group: "Work" }), ruleBuild("b.example")]);

        await section(wrapper, "Groups");
        await wrapper.get("[aria-label=\"Choose the rules in Work\"]").trigger("click");
        await wrapper.vm.$nextTick();

        const box = [...document.querySelectorAll("label")].find(node => node.textContent.trim() === "a.example");

        box?.querySelector("input")?.click();

        await wrapper.vm.$nextTick();
        await pressDialog(wrapper, "Save");

        const { groups, rules } = await stored();

        expect(groups).toEqual(["Work"]);
        expect(rules.map(rule => rule.group)).toEqual(["", ""]);
    });

    it("renames a group and carries every rule in it along", async () => {
        const wrapper = await open([
            ruleBuild("a.example", { group: "Work" }),
            ruleBuild("b.example", { group: "work" }),
            ruleBuild("c.example"),
        ]);

        await section(wrapper, "Groups");
        await wrapper.get("[aria-label=\"Rename the group Work\"]").trigger("click");
        await wrapper.vm.$nextTick();

        await fill("#group-name", "Office");
        await pressDialog(wrapper, "Save");

        const { groups, rules } = await stored();

        expect(groups).toEqual(["Office"]);
        expect(rules.map(rule => rule.group)).toEqual(["Office", "Office", ""]);
        expect(toasts.value.map(toast => toast.message)).toContain("Group renamed");
    });

    it("deletes a group and keeps the rules it held, whatever the spelling", async () => {
        const wrapper = await open([
            ruleBuild("a.example", { group: "Work" }),
            ruleBuild("b.example", { group: "work" }),
            ruleBuild("c.example"),
        ]);

        await section(wrapper, "Groups");
        await wrapper.get("[aria-label=\"Delete the group Work\"]").trigger("click");
        await pressDialog(wrapper, "Delete group");

        const { groups, rules } = await stored();

        expect(groups).toEqual([]);
        expect(rules.map(rule => rule.url)).toEqual(["a.example", "b.example", "c.example"]);
        expect(rules.every(rule => rule.group === "")).toBe(true);
        expect(toasts.value.map(toast => toast.message)).toContain("Group deleted");
    });

    it("surfaces the count of rules the browser refused", async () => {
        await testBrowser.storage.local.set({ skipped: 2 });

        const wrapper = await open([ruleBuild("a.example")]);

        await section(wrapper, "Rules");

        expect(wrapper.get("[role=\"alert\"]").text()).toContain("2 rules are not running.");
    });

    it("adds and removes both hosts of a preset in canonical form", async () => {
        const wrapper = await open();

        await section(wrapper, "Presets");
        await wrapper.get("[title=\"localhost:3000, 127.0.0.1:3000\"]").trigger("click");
        await flush();

        expect((await stored()).rules.map(rule => rule.url)).toEqual(["localhost:3000", "127.0.0.1:3000"]);

        await wrapper.get("[title=\"localhost:3000, 127.0.0.1:3000\"]").trigger("click");
        await flush();

        expect((await stored()).rules).toEqual([]);
    });

    it("adds the host a preset is missing and keeps the one already there", async () => {
        const existing = ruleBuild("localhost:3000");
        const wrapper = await open([existing]);

        await section(wrapper, "Presets");
        await wrapper.get("[title=\"localhost:3000, 127.0.0.1:3000\"]").trigger("click");
        await flush();

        const { rules } = await stored();

        expect(rules.map(rule => rule.url)).toEqual(["localhost:3000", "127.0.0.1:3000"]);
        expect(rules[0]).toEqual(existing);
    });

    it("leaves a preset alone when an equivalent rule is already there", async () => {
        const wrapper = await open([ruleBuild("localhost:3000"), ruleBuild("http://127.0.0.1:3000")]);

        await section(wrapper, "Presets");

        expect(wrapper.get("[title=\"localhost:3000, 127.0.0.1:3000\"]").attributes("aria-pressed")).toBe("true");
    });

    it("refuses a preset that would take the rule list past its maximum", async () => {
        const rules = Array.from({ length: RULES_COUNT_MAX - 1 }, (_, index) => ruleBuild(`host${index}.example`));
        const wrapper = await open(rules);

        await section(wrapper, "Presets");
        await wrapper.get("[title=\"localhost:3000, 127.0.0.1:3000\"]").trigger("click");
        await flush();

        expect(toasts.value.map(toast => toast.variant)).toEqual(["error"]);
        expect((await stored()).rules).toHaveLength(RULES_COUNT_MAX - 1);
    });

    it("shows the diagnostic the background left behind and clears it on dismissal", async () => {
        await diagnosticSave("The browser refused the rule set.");

        const wrapper = await open();

        expect(wrapper.get("[role=\"alert\"]").text()).toContain("The browser refused the rule set.");

        await press(wrapper, "Dismiss");

        expect(wrapper.find("[role=\"alert\"]").exists()).toBe(false);
        expect(await diagnosticGet()).toBeNull();
    });
});
