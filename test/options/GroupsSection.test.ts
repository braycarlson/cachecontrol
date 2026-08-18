import GroupsSection from "../../src/options/components/GroupsSection.vue";
import { afterEach, describe, expect, it } from "vitest";
import { ruleBuild } from "../helpers";
import { mount } from "@vue/test-utils";
import type { Rule } from "../../src/storage";

type Wrapper = ReturnType<typeof mount<typeof GroupsSection>>;

async function add(wrapper: Wrapper, name: string): Promise<void> {
    await wrapper.get("#groups-name").setValue(name);
    await press(wrapper, "Add group");
}

function dialog(): HTMLElement | null {
    return document.querySelector("[role=\"dialog\"]");
}

function listed(wrapper: Wrapper): string[] {
    return wrapper.findAll("li p").map(node => node.text());
}

function open(groups: string[] = [], rules: Rule[] = []): Wrapper {
    return mount(GroupsSection, { props: { groups, rules } });
}

async function press(wrapper: Wrapper, text: string): Promise<void> {
    const target = wrapper.findAll("button").find(node => node.text() === text);

    if (!target) throw new Error(`No button reads ${text}.`);

    await target.trigger("click");
}

async function pressDialog(wrapper: Wrapper, text: string): Promise<void> {
    const target = [...document.querySelectorAll("[role=\"dialog\"] button")]
        .find(node => node.textContent.trim() === text);

    if (!target) throw new Error(`No dialog button reads ${text}.`);

    (target as HTMLButtonElement).click();

    await wrapper.vm.$nextTick();
}

async function type(selector: string, value: string): Promise<void> {
    const input = document.querySelector<HTMLInputElement>(selector);

    if (!input) throw new Error(`No field is at ${selector}.`);

    input.value = value;
    input.dispatchEvent(new Event("input"));

    await new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("GroupsSection", () => {
    it("lists every group it was handed", () => {
        expect(listed(open(["Backend", "Frontend"]))).toEqual(["Backend", "Frontend"]);
    });

    it("counts the rules a group holds, whatever the spelling", () => {
        const wrapper = open(["Work"], [
            ruleBuild("a.example", { group: "Work" }),
            ruleBuild("b.example", { group: "work" }),
            ruleBuild("c.example"),
        ]);

        expect(wrapper.get("li span").text()).toBe("2");
    });

    it("says so when there is no group at all", () => {
        expect(open().text()).toContain("No groups yet.");
    });

    it("emits a trimmed name and empties the field", async () => {
        const wrapper = open();

        await add(wrapper, "  Work  ");

        expect(wrapper.emitted("add")).toEqual([["Work"]]);
        expect(wrapper.get<HTMLInputElement>("#groups-name").element.value).toBe("");
    });

    it("adds on Enter", async () => {
        const wrapper = open();

        await wrapper.get("#groups-name").setValue("Work");
        await wrapper.get("#groups-name").trigger("keydown.enter");

        expect(wrapper.emitted("add")).toEqual([["Work"]]);
    });

    it("refuses an empty name", async () => {
        const wrapper = open();

        await add(wrapper, "   ");

        expect(wrapper.get("#groups-name-error").text()).toBe("Enter a group name.");
        expect(wrapper.emitted("add")).toBeUndefined();
    });

    it("refuses a duplicate spelled another way", async () => {
        const wrapper = open(["Work"]);

        await add(wrapper, "WORK");

        expect(wrapper.get("#groups-name-error").text()).toBe("A group with this name already exists.");
        expect(wrapper.emitted("add")).toBeUndefined();
    });

    it("drops the error once the name changes", async () => {
        const wrapper = open(["Work"]);

        await add(wrapper, "Work");
        await wrapper.get("#groups-name").setValue("Office");

        expect(wrapper.find("#groups-name-error").exists()).toBe(false);
    });

    it("clears the field on Escape", async () => {
        const wrapper = open();

        await wrapper.get("#groups-name").setValue("Work");
        await wrapper.get("#groups-name").trigger("keydown.esc");

        expect(wrapper.get<HTMLInputElement>("#groups-name").element.value).toBe("");
    });

    it("asks in a dialog before it deletes, and counts what the group holds", async () => {
        const wrapper = open(["Work"], [ruleBuild("a.example", { group: "Work" })]);

        await wrapper.get("[aria-label=\"Delete the group Work\"]").trigger("click");

        expect(wrapper.emitted("remove")).toBeUndefined();
        expect(dialog()?.textContent).toContain("One rule belongs to Work");
        expect(dialog()?.textContent).toContain("moves them to Ungrouped");

        await pressDialog(wrapper, "Delete group");

        expect(wrapper.emitted("remove")).toEqual([["Work"]]);
        expect(dialog()).toBeNull();
    });

    it("counts the rules of an emptier group", async () => {
        const wrapper = open(["Work"], [
            ruleBuild("a.example", { group: "Work" }),
            ruleBuild("b.example", { group: "Work" }),
        ]);

        await wrapper.get("[aria-label=\"Delete the group Work\"]").trigger("click");

        expect(dialog()?.textContent).toContain("2 rules belong to Work");
    });

    it("says so when no rule belongs to the group it is about to delete", async () => {
        const wrapper = open(["Work"]);

        await wrapper.get("[aria-label=\"Delete the group Work\"]").trigger("click");

        expect(dialog()?.textContent).toContain("no rule belongs to it");
    });

    it("closes the delete dialog from Cancel and deletes nothing", async () => {
        const wrapper = open(["Work"]);

        await wrapper.get("[aria-label=\"Delete the group Work\"]").trigger("click");
        await pressDialog(wrapper, "Cancel");

        expect(wrapper.emitted("remove")).toBeUndefined();
        expect(dialog()).toBeNull();
    });

    it("renames a group from the dialog", async () => {
        const wrapper = open(["Work"]);

        await wrapper.get("[aria-label=\"Rename the group Work\"]").trigger("click");
        await type("#group-name", "  Office  ");
        await pressDialog(wrapper, "Save");

        expect(wrapper.emitted("rename")).toEqual([["Work", "Office"]]);
        expect(dialog()).toBeNull();
    });

    it("closes the rename dialog from Cancel and renames nothing", async () => {
        const wrapper = open(["Work"]);

        await wrapper.get("[aria-label=\"Rename the group Work\"]").trigger("click");
        await pressDialog(wrapper, "Cancel");

        expect(wrapper.emitted("rename")).toBeUndefined();
        expect(dialog()).toBeNull();
    });

    it("assigns the rules chosen in the dialog", async () => {
        const wrapper = open(["Work"], [ruleBuild("a.example"), ruleBuild("b.example", { group: "Work" })]);

        await wrapper.get("[aria-label=\"Choose the rules in Work\"]").trigger("click");

        const box = [...document.querySelectorAll("label")].find(node => node.textContent.trim() === "a.example");

        box?.querySelector("input")?.click();

        await wrapper.vm.$nextTick();
        await pressDialog(wrapper, "Save");

        expect(wrapper.emitted("assign")).toEqual([["Work", ["a.example", "b.example"]]]);
        expect(dialog()).toBeNull();
    });

    it("closes the rules dialog from Cancel and assigns nothing", async () => {
        const wrapper = open(["Work"], [ruleBuild("a.example")]);

        await wrapper.get("[aria-label=\"Choose the rules in Work\"]").trigger("click");
        await pressDialog(wrapper, "Cancel");

        expect(wrapper.emitted("assign")).toBeUndefined();
        expect(dialog()).toBeNull();
    });

    it("closes an open dialog once the group list changes underneath it", async () => {
        const wrapper = open(["Work"]);

        await wrapper.get("[aria-label=\"Delete the group Work\"]").trigger("click");
        await wrapper.setProps({ groups: [] });

        expect(dialog()).toBeNull();
    });
});
