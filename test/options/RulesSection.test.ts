import RulesSection from "../../src/options/components/RulesSection.vue";
import { afterEach, describe, expect, it } from "vitest";
import { ruleBuild } from "../helpers";
import { mount } from "@vue/test-utils";
import type { Rule } from "../../src/storage";

type Wrapper = ReturnType<typeof mount<typeof RulesSection>>;

const RULES: Rule[] = [
    ruleBuild("a.example"),
    ruleBuild("b.example"),
    ruleBuild("localhost:3000"),
];

async function add(wrapper: Wrapper, url: string): Promise<void> {
    await wrapper.get("#rules-url").setValue(url);
    await press(wrapper, "Add rule");
}

function dialog(): HTMLElement | null {
    return document.querySelector("[role=\"dialog\"]");
}

async function drop(wrapper: Wrapper, label: string): Promise<void> {
    const target = wrapper.get(`[data-section="${label}"]`);

    await target.trigger("dragover", { dataTransfer: transfer() });
    await target.trigger("drop", { dataTransfer: transfer() });
}

async function grab(wrapper: Wrapper, url: string): Promise<void> {
    await wrapper.get(`[title="Drag ${url} into a group"]`).trigger("dragstart", { dataTransfer: transfer() });
}

function headings(wrapper: Wrapper): string[] {
    return wrapper.findAll("h3").map(node => node.findAll("span").map(part => part.text()).join(" "));
}

function listed(wrapper: Wrapper): string[] {
    return wrapper.findAll("[aria-label^=\"Enable the rule for \"]")
        .map(node => (node.attributes("aria-label") ?? "").replace("Enable the rule for ", ""));
}

function open(rules: Rule[] = RULES, groups: string[] = []): Wrapper {
    return mount(RulesSection, { props: { groups, rules } });
}

async function press(wrapper: Wrapper, text: string): Promise<void> {
    const target = wrapper.findAll("button").find(node => node.text() === text);

    if (!target) throw new Error(`No button reads ${text}.`);

    await target.trigger("click");
}

async function pressDialog(wrapper: Wrapper, text: string): Promise<void> {
    const target = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === text);

    if (!target) throw new Error(`No dialog button reads ${text}.`);

    target.click();

    await wrapper.vm.$nextTick();
}

async function remove(wrapper: Wrapper, url: string): Promise<void> {
    await wrapper.get(`[aria-label="Delete the rule for ${url}"]`).trigger("click");
}

function transfer(): DataTransfer {
    const held = new Map<string, string>();

    return {
        dropEffect: "none",
        effectAllowed: "none",
        getData: (format: string): string => held.get(format) ?? "",
        setData: (format: string, data: string): void => {
            held.set(format, data);
        },
        setDragImage: (): void => undefined,
    } as unknown as DataTransfer;
}

function urls(wrapper: Wrapper): string[] {
    return wrapper.findAll("li p").map(node => node.text());
}

function value(wrapper: Wrapper, selector: string): string {
    return wrapper.get<HTMLInputElement>(selector).element.value;
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("RulesSection", () => {
    it("lists every rule it was handed", () => {
        expect(urls(open())).toEqual(["a.example", "b.example", "localhost:3000"]);
    });

    it("filters by url, ignoring case", async () => {
        const wrapper = open();

        await wrapper.get("#rules-search").setValue("LOCAL");

        expect(urls(wrapper)).toEqual(["localhost:3000"]);
    });

    it("heads nothing while no rule carries a group", () => {
        expect(open().findAll("h3")).toHaveLength(0);
    });

    it("heads a section per group and puts the ungrouped rules last", () => {
        const wrapper = open([
            ruleBuild("a.example", { group: "Work" }),
            ruleBuild("b.example"),
            ruleBuild("c.example", { group: "Backend" }),
        ]);

        expect(headings(wrapper)).toEqual(["Backend 1", "Work 1", "Ungrouped 1"]);
        expect(listed(wrapper)).toEqual(["c.example", "a.example", "b.example"]);
    });

    it("counts the rules a group holds", () => {
        const wrapper = open([
            ruleBuild("a.example", { group: "Work" }),
            ruleBuild("b.example", { group: "work" }),
            ruleBuild("c.example"),
        ]);

        expect(headings(wrapper)).toEqual(["Work 2", "Ungrouped 1"]);
    });

    it("closes and reopens a group from its heading", async () => {
        const wrapper = open([ruleBuild("a.example", { group: "Work" }), ruleBuild("b.example")]);

        await wrapper.get("h3 button").trigger("click");

        expect(wrapper.get("h3 button").attributes("aria-expanded")).toBe("false");
        expect(listed(wrapper)).toEqual(["b.example"]);

        await wrapper.get("h3 button").trigger("click");

        expect(listed(wrapper)).toEqual(["a.example", "b.example"]);
    });

    it("reopens every group once the filter changes", async () => {
        const wrapper = open([ruleBuild("a.example", { group: "Work" })]);

        await wrapper.get("h3 button").trigger("click");
        await wrapper.get("#rules-search").setValue("a");

        expect(wrapper.get("h3 button").attributes("aria-expanded")).toBe("true");
    });

    it("leaves group deletion to the groups section", () => {
        const wrapper = open([ruleBuild("a.example", { group: "Work" })]);

        expect(wrapper.find("[aria-label=\"Delete the group Work\"]").exists()).toBe(false);
    });

    it("heads a group the settings hold that no rule has joined yet", () => {
        const wrapper = open([ruleBuild("a.example")], ["Work"]);

        expect(headings(wrapper)).toEqual(["Work 0", "Ungrouped 1"]);
        expect(wrapper.get("[data-section=\"Work\"]").text()).toContain("Drag a rule here to put it in Work");
    });

    it("keeps an empty group out of a filtered list", async () => {
        const wrapper = open([ruleBuild("a.example")], ["Work"]);

        await wrapper.get("#rules-search").setValue("a");

        expect(headings(wrapper)).toEqual(["Ungrouped 1"]);
    });

    it("offers no drag handle while there is no group to drag into", () => {
        expect(open().find("[title^=\"Drag \"]").exists()).toBe(false);
    });

    it("moves a dragged rule into the group it was dropped on", async () => {
        const wrapper = open([ruleBuild("a.example"), ruleBuild("b.example")], ["Work"]);

        await grab(wrapper, "a.example");
        await drop(wrapper, "Work");

        expect(wrapper.emitted("assign")).toEqual([["a.example", "Work"]]);
    });

    it("ungroups a rule dropped on the ungrouped section", async () => {
        const wrapper = open([ruleBuild("a.example", { group: "Work" })], ["Work"]);

        await grab(wrapper, "a.example");
        await drop(wrapper, "Ungrouped");

        expect(wrapper.emitted("assign")).toEqual([["a.example", ""]]);
    });

    it("marks the section under the rule being dragged", async () => {
        const wrapper = open([ruleBuild("a.example")], ["Work"]);

        await grab(wrapper, "a.example");
        await wrapper.get("[data-section=\"Work\"]").trigger("dragover", { dataTransfer: transfer() });

        expect(wrapper.get("[data-section=\"Work\"]").classes()).toContain("border-accent");
        expect(wrapper.get("[data-section=\"Ungrouped\"]").classes()).not.toContain("border-accent");

        await wrapper.get("[data-section=\"Work\"]").trigger("dragleave");

        expect(wrapper.get("[data-section=\"Work\"]").classes()).not.toContain("border-accent");
    });

    it("marks nothing while no rule is being dragged", async () => {
        const wrapper = open([ruleBuild("a.example")], ["Work"]);

        await wrapper.get("[data-section=\"Work\"]").trigger("dragover", { dataTransfer: transfer() });

        expect(wrapper.get("[data-section=\"Work\"]").classes()).not.toContain("border-accent");
    });

    it("emits nothing when a rule lands on the group it is already in", async () => {
        const wrapper = open([ruleBuild("a.example", { group: "Work" })], ["Work"]);

        await grab(wrapper, "a.example");
        await drop(wrapper, "Work");

        expect(wrapper.emitted("assign")).toBeUndefined();
    });

    it("emits nothing on a drop that started outside the list", async () => {
        const wrapper = open([ruleBuild("a.example")], ["Work"]);

        await drop(wrapper, "Work");

        expect(wrapper.emitted("assign")).toBeUndefined();
    });

    it("drops the drag once the filter changes", async () => {
        const wrapper = open([ruleBuild("a.example"), ruleBuild("b.example", { group: "Work" })], ["Work"]);

        await grab(wrapper, "a.example");
        await wrapper.get("#rules-search").setValue("example");
        await drop(wrapper, "Work");

        expect(wrapper.emitted("assign")).toBeUndefined();
    });

    it("drops the drag when the handle is released", async () => {
        const wrapper = open([ruleBuild("a.example")], ["Work"]);

        await grab(wrapper, "a.example");
        await wrapper.get("[title=\"Drag a.example into a group\"]").trigger("dragend");
        await drop(wrapper, "Work");

        expect(wrapper.emitted("assign")).toBeUndefined();
    });

    it("shows the name above the url it belongs to", () => {
        const wrapper = open([ruleBuild("a.example", { name: "Staging API" })]);

        expect(wrapper.findAll("li p").map(node => node.text())).toEqual(["Staging API", "a.example"]);
    });

    it("filters by name, ignoring case", async () => {
        const wrapper = open([ruleBuild("a.example", { name: "Staging API" }), ruleBuild("b.example")]);

        await wrapper.get("#rules-search").setValue("STAGING");

        expect(listed(wrapper)).toEqual(["a.example"]);
    });

    it("filters by group, ignoring case", async () => {
        const wrapper = open([ruleBuild("a.example", { group: "Backend" }), ruleBuild("b.example")]);

        await wrapper.get("#rules-search").setValue("backend");

        expect(listed(wrapper)).toEqual(["a.example"]);
    });

    it("says so when nothing matches the filter", async () => {
        const wrapper = open();

        await wrapper.get("#rules-search").setValue("nothing");

        expect(urls(wrapper)).toEqual([]);
        expect(wrapper.text()).toContain("No rule matches");
    });

    it("says so when there is no rule at all", () => {
        expect(open([]).text()).toContain("No rules yet.");
    });

    it("puts the filter out of reach until there is a rule to filter", () => {
        expect(open([]).get("#rules-search").element.closest("[inert]")).not.toBeNull();
        expect(open().get("#rules-search").element.closest("[inert]")).toBeNull();
    });

    it("drops the filter text once the last rule goes", async () => {
        const wrapper = open();

        await wrapper.get("#rules-search").setValue("local");
        await wrapper.setProps({ rules: [] });

        expect(value(wrapper, "#rules-search")).toBe("");
    });

    it("clears the filter on Escape", async () => {
        const wrapper = open();

        await wrapper.get("#rules-search").setValue("local");
        await wrapper.get("#rules-search").trigger("keydown.esc");

        expect(urls(wrapper)).toEqual(["a.example", "b.example", "localhost:3000"]);
    });

    it("refuses a url no rule can match and emits nothing", async () => {
        const wrapper = open();

        await add(wrapper, "chrome://settings");

        expect(wrapper.get("#rules-url-error").text()).toBe("That is not a URL a rule can match.");
        expect(wrapper.emitted("add")).toBeUndefined();
    });

    it("refuses a duplicate spelled another way", async () => {
        const wrapper = open();

        await add(wrapper, "http://localhost:3000");

        expect(wrapper.get("#rules-url-error").text()).toBe("A rule for this URL already exists.");
        expect(wrapper.emitted("add")).toBeUndefined();
    });

    it("emits a trimmed url and empties the field", async () => {
        const wrapper = open();

        await add(wrapper, "  c.example  ");

        expect(wrapper.emitted("add")).toEqual([["c.example"]]);
        expect(value(wrapper, "#rules-url")).toBe("");
    });

    it("adds on Enter", async () => {
        const wrapper = open();

        await wrapper.get("#rules-url").setValue("c.example");
        await wrapper.get("#rules-url").trigger("keydown.enter");

        expect(wrapper.emitted("add")).toEqual([["c.example"]]);
    });

    it("drops the error once the url changes", async () => {
        const wrapper = open();

        await add(wrapper, "chrome://settings");
        await wrapper.get("#rules-url").setValue("c.example");

        expect(wrapper.find("#rules-url-error").exists()).toBe(false);
    });

    it("emits a toggle for the rule the switch belongs to", async () => {
        const wrapper = open();

        await wrapper.get("[aria-label=\"Enable the rule for b.example\"]").trigger("click");

        expect(wrapper.emitted("toggle")).toEqual([["b.example", false]]);
    });

    it("emits a configure request from the edit control", async () => {
        const wrapper = open();

        await wrapper.get("[aria-label=\"Edit the rule for a.example\"]").trigger("click");

        expect(wrapper.emitted("configure")).toEqual([["a.example"]]);
    });

    it("asks in a dialog before it deletes, and names the rule", async () => {
        const wrapper = open();

        await remove(wrapper, "a.example");

        expect(wrapper.emitted("remove")).toBeUndefined();
        expect(dialog()?.textContent).toContain("a.example");

        await pressDialog(wrapper, "Delete rule");

        expect(wrapper.emitted("remove")).toEqual([["a.example"]]);
        expect(dialog()).toBeNull();
    });

    it("closes the dialog from Cancel and deletes nothing", async () => {
        const wrapper = open();

        await remove(wrapper, "a.example");
        await pressDialog(wrapper, "Cancel");

        expect(wrapper.emitted("remove")).toBeUndefined();
        expect(dialog()).toBeNull();
    });

    it("closes the dialog on Escape", async () => {
        const wrapper = open();

        await remove(wrapper, "a.example");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("remove")).toBeUndefined();
        expect(dialog()).toBeNull();
    });

    it("closes the dialog when the filter changes", async () => {
        const wrapper = open();

        await remove(wrapper, "a.example");
        await wrapper.get("#rules-search").setValue("a");

        expect(dialog()).toBeNull();
    });

    it("says nothing about skipped rules while every rule runs", () => {
        expect(open().find("[role=\"alert\"]").exists()).toBe(false);
    });

    it("names one rule the browser refused", () => {
        const wrapper = mount(RulesSection, { props: { rules: RULES, skipped: 1 } });

        expect(wrapper.get("[role=\"alert\"]").text()).toContain("One rule is not running.");
    });

    it("counts the rules the browser refused", () => {
        const wrapper = mount(RulesSection, { props: { rules: RULES, skipped: 3 } });

        expect(wrapper.get("[role=\"alert\"]").text()).toContain("3 rules are not running.");
    });

    it("clears the field on Escape", async () => {
        const wrapper = open();

        await wrapper.get("#rules-url").setValue("c.example");
        await wrapper.get("#rules-url").trigger("keydown.esc");

        expect(value(wrapper, "#rules-url")).toBe("");
        expect(wrapper.emitted("add")).toBeUndefined();
    });
});
