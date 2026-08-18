import RuleModal from "../../src/options/components/RuleModal.vue";
import { RESOURCES_DEFAULT } from "../../src/constant";
import { afterEach, describe, expect, it } from "vitest";
import { ruleBuild } from "../helpers";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { Rule } from "../../src/storage";

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

function checked(label: string): boolean {
    return checkbox(label).checked;
}

function field(selector: string): HTMLInputElement {
    const target = document.querySelector<HTMLInputElement>(selector);

    if (!target) throw new Error(`No field is at ${selector}.`);

    return target;
}

function open(rule: Rule | undefined, url = "localhost:3000", groups: string[] = []): ReturnType<typeof mount> {
    return mount(RuleModal, { attachTo: document.body, props: { groups, rule, url } });
}

function options(selector: string): string[] {
    return [...select(selector).options].map(node => node.textContent.trim());
}

async function pick(selector: string, value: string): Promise<void> {
    const target = select(selector);

    target.value = value;
    target.dispatchEvent(new Event("change"));

    await nextTick();
}

function select(selector: string): HTMLSelectElement {
    const target = document.querySelector<HTMLSelectElement>(selector);

    if (!target) throw new Error(`No select is at ${selector}.`);

    return target;
}

async function toggle(label: string): Promise<void> {
    checkbox(label).click();

    await nextTick();
}

async function type(selector: string, value: string): Promise<void> {
    const input = field(selector);

    input.value = value;
    input.dispatchEvent(new Event("input"));

    await nextTick();
}

afterEach(() => {
    document.body.innerHTML = "";
});

describe("RuleModal", () => {
    it("draws the draft from the rule it was handed", () => {
        open(ruleBuild("localhost:3000", { protocols: ["http"], resources: ["script"], wildcard: false }));

        expect(checked("Script")).toBe(true);
        expect(checked("Image")).toBe(false);
        expect(checked("HTTP")).toBe(true);
        expect(checked("HTTPS")).toBe(false);
        expect(checked("Match every path under this URL")).toBe(false);
    });

    it("falls back to every protocol and resource when no rule is there", () => {
        open(undefined);

        expect(checked("All resources")).toBe(true);
        expect(checked("HTTP")).toBe(true);
        expect(checked("HTTPS")).toBe(true);
    });

    it("keeps Save inert until the draft differs from the rule", async () => {
        open(ruleBuild("localhost:3000"));

        expect(button("Save").disabled).toBe(true);

        await toggle("Script");

        expect(button("Save").disabled).toBe(false);

        await toggle("Script");

        expect(button("Save").disabled).toBe(true);
    });

    it("drives the all-resources box from the selection underneath it", async () => {
        open(ruleBuild("localhost:3000"));

        expect(checkbox("All resources").checked).toBe(true);
        expect(checkbox("All resources").indeterminate).toBe(false);

        await toggle("Script");

        expect(checkbox("All resources").checked).toBe(false);
        expect(checkbox("All resources").indeterminate).toBe(true);
    });

    it("clears and restores every resource from the all-resources box", async () => {
        open(ruleBuild("localhost:3000"));

        await toggle("All resources");

        expect(checked("Script")).toBe(false);
        expect(checkbox("All resources").indeterminate).toBe(false);

        await toggle("All resources");

        expect(checked("Script")).toBe(true);
        expect(checked("Other")).toBe(true);
        expect(button("Save").disabled).toBe(true);
    });

    it("refuses a draft that selects no resource", async () => {
        open(ruleBuild("localhost:3000"));

        await toggle("All resources");

        expect(button("Save").disabled).toBe(true);
        expect(document.body.textContent).toContain("Pick at least one resource");
    });

    it("refuses a draft that selects no protocol", async () => {
        open(ruleBuild("localhost:3000", { protocols: ["http"] }));

        await toggle("HTTP");

        expect(button("Save").disabled).toBe(true);
        expect(document.body.textContent).toContain("Pick at least one protocol");
    });

    it("takes the draft again once a resource comes back", async () => {
        open(ruleBuild("localhost:3000"));

        await toggle("All resources");
        await toggle("Script");

        expect(button("Save").disabled).toBe(false);
    });

    it("saves every resource the default set holds", async () => {
        const wrapper = open(ruleBuild("localhost:3000", { resources: ["script"] }));

        await toggle("All resources");

        button("Save").click();

        expect(wrapper.emitted("save")?.[0]).toEqual([{
            group: "",
            name: "",
            protocols: ["http", "https"],
            resources: [...RESOURCES_DEFAULT],
            wildcard: true,
        }]);
    });

    it("carries the draft in the payload it saves", async () => {
        const wrapper = open(ruleBuild("localhost:3000", { protocols: ["http"], resources: ["script"] }));

        await toggle("Image");
        await toggle("Match every path under this URL");

        button("Save").click();

        expect(wrapper.emitted("save")?.[0]).toEqual([{
            group: "",
            name: "",
            protocols: ["http"],
            resources: ["script", "image"],
            wildcard: false,
        }]);
    });

    it("draws the name and the group from the rule it was handed", () => {
        open(ruleBuild("localhost:3000", { group: "Frontend", name: "Local React" }), "localhost:3000", ["Frontend"]);

        expect(field("#rule-name").value).toBe("Local React");
        expect(select("#rule-group").value).toBe("Frontend");
    });

    it("carries a renamed rule and the group it was pointed at in the payload it saves", async () => {
        const wrapper = open(ruleBuild("localhost:3000"), "localhost:3000", ["Frontend"]);

        await type("#rule-name", "  Local React  ");
        await pick("#rule-group", "Frontend");

        button("Save").click();

        expect(wrapper.emitted("save")?.[0]).toEqual([{
            group: "Frontend",
            name: "Local React",
            protocols: ["http", "https"],
            resources: [...RESOURCES_DEFAULT],
            wildcard: true,
        }]);
    });

    it("ungroups a rule from the no-group option", async () => {
        const wrapper = open(ruleBuild("localhost:3000", { group: "Frontend" }), "localhost:3000", ["Frontend"]);

        await pick("#rule-group", "");

        expect(button("Save").disabled).toBe(false);

        button("Save").click();

        expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({ group: "" });
    });

    it("keeps Save inert until the name differs from the rule", async () => {
        open(ruleBuild("localhost:3000", { name: "Local React" }));

        expect(button("Save").disabled).toBe(true);

        await type("#rule-name", "Local React ");

        expect(button("Save").disabled).toBe(true);

        await type("#rule-name", "Vite dev");

        expect(button("Save").disabled).toBe(false);
    });

    it("keeps Save inert until the group differs from the rule", async () => {
        open(ruleBuild("localhost:3000", { group: "Frontend" }), "localhost:3000", ["Backend", "Frontend"]);

        expect(button("Save").disabled).toBe(true);

        await pick("#rule-group", "Backend");

        expect(button("Save").disabled).toBe(false);
    });

    it("offers no group and every group that exists", () => {
        open(ruleBuild("localhost:3000"), "localhost:3000", ["Backend", "Frontend"]);

        expect(options("#rule-group")).toEqual(["No group", "Backend", "Frontend"]);
    });

    it("offers the group a rule carries even when no group list holds it", () => {
        open(ruleBuild("localhost:3000", { group: "Gone" }), "localhost:3000", ["Backend"]);

        expect(options("#rule-group")).toEqual(["No group", "Gone", "Backend"]);
        expect(select("#rule-group").value).toBe("Gone");
    });

    it("closes from Cancel", () => {
        const wrapper = open(ruleBuild("localhost:3000"));

        button("Cancel").click();

        expect(wrapper.emitted("close")).toHaveLength(1);
    });

    it("keeps an open draft when the rule object is replaced underneath it", async () => {
        const wrapper = open(ruleBuild("localhost:3000"));

        await toggle("Script");

        expect(checked("Script")).toBe(false);

        await wrapper.setProps({ rule: ruleBuild("localhost:3000") });

        expect(checked("Script")).toBe(false);
    });

    it("redraws the draft when the modal opens on another rule", async () => {
        const wrapper = open(ruleBuild("localhost:3000"));

        await toggle("Script");

        await wrapper.setProps({ rule: ruleBuild("localhost:4000"), url: "localhost:4000" });

        expect(checked("Script")).toBe(true);
    });
});
