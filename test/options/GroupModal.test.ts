import GroupModal from "../../src/options/components/GroupModal.vue";
import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

function button(text: string): HTMLButtonElement {
    const target = [...document.querySelectorAll("button")].find(node => node.textContent.trim() === text);

    if (!target) throw new Error(`No button reads ${text}.`);

    return target;
}

function field(selector: string): HTMLInputElement {
    const target = document.querySelector<HTMLInputElement>(selector);

    if (!target) throw new Error(`No field is at ${selector}.`);

    return target;
}

function open(group: string, groups: string[] = []): ReturnType<typeof mount> {
    return mount(GroupModal, { attachTo: document.body, props: { group, groups } });
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

describe("GroupModal", () => {
    it("draws the name from the group it was handed", () => {
        open("Work");

        expect(field("#group-name").value).toBe("Work");
    });

    it("keeps Save inert until the name differs from the group", async () => {
        open("Work");

        expect(button("Save").disabled).toBe(true);

        await type("#group-name", "Work ");

        expect(button("Save").disabled).toBe(true);

        await type("#group-name", "Office");

        expect(button("Save").disabled).toBe(false);
    });

    it("emits a trimmed name", async () => {
        const wrapper = open("Work");

        await type("#group-name", "  Office  ");

        button("Save").click();

        expect(wrapper.emitted("save")).toEqual([["Office"]]);
    });

    it("saves on Enter", async () => {
        const wrapper = open("Work");

        await type("#group-name", "Office");

        field("#group-name").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(wrapper.emitted("save")).toEqual([["Office"]]);
    });

    it("refuses an empty name", async () => {
        const wrapper = open("Work");

        await type("#group-name", "   ");

        button("Save").click();

        await nextTick();

        expect(field("#group-name-error").textContent).toBe("Enter a group name.");
        expect(wrapper.emitted("save")).toBeUndefined();
    });

    it("refuses the name of another group", async () => {
        const wrapper = open("Work", ["Office", "Work"]);

        await type("#group-name", "office");

        button("Save").click();

        await nextTick();

        expect(field("#group-name-error").textContent).toBe("A group with this name already exists.");
        expect(wrapper.emitted("save")).toBeUndefined();
    });

    it("drops the error once the name changes", async () => {
        open("Work", ["Office"]);

        await type("#group-name", "Office");

        button("Save").click();

        await nextTick();
        await type("#group-name", "Studio");

        expect(document.querySelector("#group-name-error")).toBeNull();
    });

    it("redraws the draft when the modal opens on another group", async () => {
        const wrapper = open("Work");

        await type("#group-name", "Office");

        await wrapper.setProps({ group: "Backend" });

        expect(field("#group-name").value).toBe("Backend");
    });

    it("closes from Cancel", () => {
        const wrapper = open("Work");

        button("Cancel").click();

        expect(wrapper.emitted("close")).toHaveLength(1);
    });
});
