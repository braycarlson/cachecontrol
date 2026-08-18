import BaseToast from "../../src/components/BaseToast.vue";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { useToast } from "../../src/composables/toast";

const { notify, toasts } = useToast();

function rendered(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>("[role=\"status\"], [role=\"alert\"]")];
}

beforeEach(() => {
    toasts.value = [];
});

afterEach(() => {
    document.body.innerHTML = "";
});

describe("BaseToast", () => {
    it("renders nothing while there is nothing to say", () => {
        mount(BaseToast, { attachTo: document.body });

        expect(rendered()).toHaveLength(0);
    });

    it("announces a success as a status", async () => {
        mount(BaseToast, { attachTo: document.body });

        notify("Rule added");

        await nextTick();

        const [toast] = rendered();

        expect(toast?.getAttribute("role")).toBe("status");
        expect(toast?.textContent.trim()).toBe("Rule added");
        expect(toast?.className).toContain("border-border");
    });

    it("announces a failure as an alert", async () => {
        mount(BaseToast, { attachTo: document.body });

        notify("The change was not saved.", "error");

        await nextTick();

        const [toast] = rendered();

        expect(toast?.getAttribute("role")).toBe("alert");
        expect(toast?.className).toContain("border-danger");
        expect(toast?.querySelector("svg")?.getAttribute("class")).toContain("text-danger");
    });
});
