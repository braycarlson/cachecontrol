import GroupRulesModal from "../../src/options/components/GroupRulesModal.vue";
import { afterEach, describe, expect, it } from "vitest";
import { ruleBuild } from "../helpers";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { Rule } from "../../src/storage";

const RULES: Rule[] = [
    ruleBuild("a.example", { group: "Work", name: "Staging API" }),
    ruleBuild("b.example", { group: "Backend" }),
    ruleBuild("c.example"),
];

function button(text: string): HTMLButtonElement {
    const target = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === text);

    if (!target) throw new Error(`No button reads ${text}.`);

    return target;
}

function checkbox(label: string): HTMLInputElement {
    const target = [...document.querySelectorAll("label")].find(node => node.textContent.trim() === label);
    const input = target?.querySelector("input");

    if (!input) throw new Error(`No checkbox is labelled ${label}.`);

    return input;
}

function labels(): string[] {
    return [...document.querySelectorAll("label")]
        .map(node => node.textContent.trim())
        .filter(text => text !== "Search rules");
}

function open(group = "Work", rules: Rule[] = RULES): ReturnType<typeof mount> {
    return mount(GroupRulesModal, { attachTo: document.body, props: { group, rules } });
}

async function toggle(label: string): Promise<void> {
    checkbox(label).click();

    await nextTick();
}

async function type(selector: string, value: string): Promise<void> {
    const input = document.querySelector<HTMLInputElement>(selector);

    if (!input) throw new Error(`No field is at ${selector}.`);

    input.value = value;
    input.dispatchEvent(new Event("input"));

    await nextTick();
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("GroupRulesModal", () => {
    it("lists every rule and names one by its display name", () => {
        open();

        expect(labels()).toEqual(["Staging API", "b.example", "c.example"]);
    });

    it("checks the rules already in the group", () => {
        open();

        expect(checkbox("Staging API").checked).toBe(true);
        expect(checkbox("c.example").checked).toBe(false);
    });

    it("names the group a rule would be taken out of", () => {
        open();

        expect(document.body.textContent).toContain("Backend");
    });

    it("keeps Save inert until the selection differs", async () => {
        open();

        expect(button("Save").disabled).toBe(true);

        await toggle("c.example");

        expect(button("Save").disabled).toBe(false);

        await toggle("c.example");

        expect(button("Save").disabled).toBe(true);
    });

    it("emits every checked url in the order the rules are held", async () => {
        const wrapper = open();

        await toggle("c.example");
        await toggle("b.example");

        button("Save").click();

        expect(wrapper.emitted("save")).toEqual([[["a.example", "b.example", "c.example"]]]);
    });

    it("emits an empty list once every rule is unchecked", async () => {
        const wrapper = open();

        await toggle("Staging API");

        button("Save").click();

        expect(wrapper.emitted("save")).toEqual([[[]]]);
    });

    it("keeps a rule checked while the filter hides it", async () => {
        const wrapper = open();

        await toggle("c.example");
        await type("#group-rules-search", "b.example");

        expect(labels()).toEqual(["b.example"]);

        button("Save").click();

        expect(wrapper.emitted("save")).toEqual([[["a.example", "c.example"]]]);
    });

    it("scrolls the rules on their own, keeping the filter and the footer in place", () => {
        open("Work", Array.from({ length: 40 }, (_, index) => ruleBuild(`host-${index}.example`)));

        const box = checkbox("host-0.example").closest("[class*=\"overflow-y-auto\"]");

        expect(box).not.toBeNull();
        expect(box?.className).toContain("max-h-72");
        expect(box?.contains(document.querySelector("#group-rules-search"))).toBe(false);
        expect(box?.contains(button("Save"))).toBe(false);
    });

    it("says so when nothing matches the filter", async () => {
        open();

        await type("#group-rules-search", "nothing");

        expect(document.body.textContent).toContain("No rule matches");
    });

    it("says so when there is no rule at all", () => {
        open("Work", []);

        expect(document.body.textContent).toContain("There is no rule to put in a group yet.");
    });

    it("redraws the selection when the modal opens on another group", async () => {
        const wrapper = open();

        await toggle("Staging API");

        await wrapper.setProps({ group: "Backend" });

        expect(checkbox("Staging API").checked).toBe(false);
        expect(checkbox("b.example").checked).toBe(true);
    });

    it("closes from Cancel", () => {
        const wrapper = open();

        button("Cancel").click();

        expect(wrapper.emitted("close")).toHaveLength(1);
    });
});
