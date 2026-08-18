import BaseCheckbox from "../../src/components/BaseCheckbox.vue";
import BaseChip from "../../src/components/BaseChip.vue";
import BaseField from "../../src/components/BaseField.vue";
import BaseModal from "../../src/components/BaseModal.vue";
import BaseSwitch from "../../src/components/BaseSwitch.vue";
import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

afterEach(() => {
    document.body.innerHTML = "";
});

describe("BaseSwitch", () => {
    it("reports its state to assistive technology", () => {
        const wrapper = mount(BaseSwitch, { props: { label: "Enable CacheControl", modelValue: true } });

        expect(wrapper.attributes("role")).toBe("switch");
        expect(wrapper.attributes("aria-checked")).toBe("true");
        expect(wrapper.attributes("aria-label")).toBe("Enable CacheControl");
    });

    it("emits the opposite of what it holds when clicked", async () => {
        const wrapper = mount(BaseSwitch, { props: { label: "Toggle", modelValue: false } });

        await wrapper.trigger("click");

        expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
    });

    it("stays put while disabled", async () => {
        const wrapper = mount(BaseSwitch, { props: { disabled: true, label: "Toggle", modelValue: false } });

        await wrapper.trigger("click");

        expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });
});

describe("BaseChip", () => {
    it("stays an inert span until it is told to be interactive", async () => {
        const wrapper = mount(BaseChip, { slots: { default: "Frontend" } });

        await wrapper.trigger("click");

        expect(wrapper.element.tagName).toBe("SPAN");
        expect(wrapper.attributes("aria-pressed")).toBeUndefined();
        expect(wrapper.emitted("toggle")).toBeUndefined();
    });

    it("reports its state and emits a toggle once interactive", async () => {
        const wrapper = mount(BaseChip, { props: { active: true, interactive: true }, slots: { default: "React :3000" } });

        await wrapper.trigger("click");

        expect(wrapper.attributes("aria-pressed")).toBe("true");
        expect(wrapper.emitted("toggle")).toHaveLength(1);
    });
});

describe("BaseCheckbox", () => {
    it("emits on change", async () => {
        const wrapper = mount(BaseCheckbox, { props: { label: "Script", modelValue: false } });

        await wrapper.get("input").setValue(true);

        expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
    });

    it("drives the indeterminate property of the input", async () => {
        const wrapper = mount(BaseCheckbox, {
            props: { indeterminate: true, label: "All resources", modelValue: false },
        });

        await nextTick();

        expect(wrapper.get("input").element.indeterminate).toBe(true);

        await wrapper.setProps({ indeterminate: false });

        expect(wrapper.get("input").element.indeterminate).toBe(false);
    });

    it("refuses input while disabled", () => {
        const wrapper = mount(BaseCheckbox, { props: { disabled: true, label: "Script", modelValue: false } });

        expect(wrapper.get("input").attributes("disabled")).toBeDefined();
    });
});

describe("BaseField", () => {
    it("labels the input and hides the label on request", () => {
        const wrapper = mount(BaseField, { props: { hideLabel: true, id: "url", label: "URL", modelValue: "" } });

        expect(wrapper.get("label").attributes("for")).toBe("url");
        expect(wrapper.get("label").classes()).toContain("sr-only");
    });

    it("wires an error to the input that carries it", async () => {
        const wrapper = mount(BaseField, { props: { id: "url", label: "URL", modelValue: "" } });

        expect(wrapper.get("input").attributes("aria-describedby")).toBeUndefined();

        await wrapper.setProps({ error: "Enter a URL." });

        expect(wrapper.get("input").attributes("aria-describedby")).toBe("url-error");
        expect(wrapper.get("input").attributes("aria-invalid")).toBe("true");
        expect(wrapper.get("#url-error").text()).toBe("Enter a URL.");
    });

    it("focuses the input through the method it exposes", () => {
        const wrapper = mount(BaseField, {
            attachTo: document.body,
            props: { id: "url", label: "URL", modelValue: "" },
        });

        wrapper.vm.focus();

        expect(document.activeElement).toBe(wrapper.get("input").element);
    });
});

describe("BaseModal", () => {
    function open(): ReturnType<typeof mount> {
        return mount(BaseModal, {
            attachTo: document.body,
            props: { title: "localhost:3000" },
            slots: {
                default: "<button type=\"button\" id=\"middle\">Middle</button>",
                footer: "<button type=\"button\" id=\"last\">Last</button>",
            },
        });
    }

    function click(selector: string): void {
        document.querySelector(selector)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }

    function press(key: string, shiftKey = false): void {
        document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key, shiftKey }));
    }

    it("names the dialog for assistive technology", () => {
        open();

        const dialog = document.querySelector("[role=\"dialog\"]");

        expect(dialog?.getAttribute("aria-modal")).toBe("true");
        expect(dialog?.getAttribute("aria-label")).toBe("localhost:3000");
    });

    it("closes on Escape", () => {
        const wrapper = open();

        press("Escape");

        expect(wrapper.emitted("close")).toHaveLength(1);
    });

    it("closes on a click outside the panel", () => {
        const wrapper = open();

        click(".fixed");

        expect(wrapper.emitted("close")).toHaveLength(1);
    });

    it("stays open on a click inside the panel", () => {
        const wrapper = open();

        click("[role=\"dialog\"]");

        expect(wrapper.emitted("close")).toBeUndefined();
    });

    it("focuses the first control it holds", () => {
        open();

        expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    });

    it("wraps Tab from the last control back to the first", () => {
        open();

        document.querySelector<HTMLElement>("#last")?.focus();

        press("Tab");

        expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    });

    it("wraps Shift+Tab from the first control to the last", () => {
        open();

        press("Tab", true);

        expect(document.activeElement?.id).toBe("last");
    });

    it("leaves a Tab in the middle of the panel alone", () => {
        open();

        document.querySelector<HTMLElement>("#middle")?.focus();

        press("Tab");

        expect(document.activeElement?.id).toBe("middle");
    });

    it("restores focus to whatever held it before", async () => {
        const opener = document.createElement("button");

        document.body.append(opener);
        opener.focus();

        const wrapper = open();

        expect(document.activeElement).not.toBe(opener);

        wrapper.unmount();
        await Promise.resolve();

        expect(document.activeElement).toBe(opener);
    });
});
