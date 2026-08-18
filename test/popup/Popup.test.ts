import Popup from "../../src/popup/Popup.vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, ruleBuild, settingsSeed } from "../helpers";
import { mount } from "@vue/test-utils";
import { RULES_COUNT_MAX } from "../../src/constant";
import { testBrowser } from "../browser";
import { useToast } from "../../src/composables/toast";
import type { Rule } from "../../src/storage";
import type { Tabs } from "webextension-polyfill";

type Wrapper = ReturnType<typeof mount<typeof Popup>>;

const { toasts } = useToast();

async function open(url: string | null, rules: Rule[] = [], enabled = true): Promise<Wrapper> {
    vi.spyOn(testBrowser.tabs, "query").mockResolvedValue(url === null ? [] : [{ url } as unknown as Tabs.Tab]);

    await settingsSeed(rules, enabled);

    const wrapper = mount(Popup, { attachTo: document.body });

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

async function storedRules(): Promise<Rule[]> {
    const values = await testBrowser.storage.local.get("rules");

    return (values["rules"] ?? []) as Rule[];
}

beforeEach(() => {
    toasts.value = [];
});

afterEach(() => {
    document.body.innerHTML = "";

    vi.restoreAllMocks();
});

describe("Popup", () => {
    it("names the host of the current tab", async () => {
        const wrapper = await open("http://localhost:3000/app");

        expect(wrapper.text()).toContain("localhost:3000");
    });

    it("says so when the page has no address a rule can match", async () => {
        const wrapper = await open("about:blank");

        expect(wrapper.text()).toContain("This page has no address a rule can match.");
    });

    it("says so when the window holds no tab", async () => {
        const wrapper = await open(null);

        expect(wrapper.text()).toContain("This page has no address a rule can match.");
    });

    it("adds a rule for the current site in its canonical form", async () => {
        const wrapper = await open("http://localhost:3000/app");

        await press(wrapper, "Disable cache for this site");

        expect((await storedRules()).map(rule => rule.url)).toEqual(["localhost:3000"]);
        expect(toasts.value.map(toast => toast.message)).toEqual(["Cache disabled for localhost:3000"]);
    });

    it("refuses the current site once the rule list is full", async () => {
        const rules = Array.from({ length: RULES_COUNT_MAX }, (_, index) => ruleBuild(`host${index}.example`));
        const wrapper = await open("http://localhost:3000/app", rules);

        await press(wrapper, "Disable cache for this site");

        expect((await storedRules())).toHaveLength(RULES_COUNT_MAX);
        expect(toasts.value.map(toast => toast.variant)).toEqual(["error"]);
    });

    it("shows a switch instead of the add control once a rule covers the site", async () => {
        const wrapper = await open("http://localhost:3000/", [ruleBuild("localhost:3000")]);

        expect(wrapper.text()).toContain("Cache is disabled here.");
        expect(wrapper.findAll("button").some(node => node.text() === "Disable cache for this site")).toBe(false);
    });

    it("finds the rule for the current site even when it was stored another way", async () => {
        const wrapper = await open("http://localhost:3000/", [
            { ...ruleBuild("localhost:3000"), url: "HTTPS://LOCALHOST:3000/" },
        ]);

        expect(wrapper.text()).toContain("Cache is disabled here.");
    });

    it("writes the rule toggle through to storage", async () => {
        const wrapper = await open("http://localhost:3000/", [ruleBuild("localhost:3000")]);

        await wrapper.get("[aria-label=\"Disable cache for localhost:3000\"]").trigger("click");
        await flush();

        expect((await storedRules())[0]?.enabled).toBe(false);
    });

    it("writes the global toggle through to storage", async () => {
        const wrapper = await open("http://localhost:3000/");

        await wrapper.get("[aria-label=\"Enable CacheControl\"]").trigger("click");
        await flush();

        expect((await testBrowser.storage.local.get("enabled"))["enabled"]).toBe(false);
    });

    it("refuses a custom url no rule can match and keeps the form open", async () => {
        const wrapper = await open("http://localhost:3000/");

        await press(wrapper, "Add custom URL");
        await wrapper.get("#popup-url").setValue("chrome://settings");
        await press(wrapper, "Add rule");

        expect(wrapper.get("#popup-url-error").text()).toBe("That is not a URL a rule can match.");
        expect(await storedRules()).toEqual([]);
    });

    it("clears the custom url form on Cancel", async () => {
        const wrapper = await open("http://localhost:3000/");

        await press(wrapper, "Add custom URL");
        await wrapper.get("#popup-url").setValue("b.example");
        await press(wrapper, "Cancel");

        expect(wrapper.find("#popup-url").exists()).toBe(false);
        expect(await storedRules()).toEqual([]);
    });

    it("adds a custom url and closes the form", async () => {
        const wrapper = await open("http://localhost:3000/");

        await press(wrapper, "Add custom URL");
        await wrapper.get("#popup-url").setValue("  b.example  ");
        await press(wrapper, "Add rule");

        expect((await storedRules()).map(rule => rule.url)).toEqual(["b.example"]);
        expect(wrapper.find("#popup-url").exists()).toBe(false);
    });

    it("lists no rule other than the one for the current site", async () => {
        const wrapper = await open("http://localhost:3000/", [
            ruleBuild("localhost:3000"),
            ruleBuild("a.example", { name: "Staging API" }),
            ruleBuild("b.example"),
        ]);

        expect(wrapper.text()).not.toContain("a.example");
        expect(wrapper.text()).not.toContain("Staging API");
        expect(wrapper.text()).not.toContain("b.example");
        expect(wrapper.text()).toContain("localhost:3000");
    });

    it("keeps the switch count to the global one and the one for the current site", async () => {
        const wrapper = await open("http://localhost:3000/", [
            ruleBuild("localhost:3000"),
            ruleBuild("a.example"),
            ruleBuild("b.example"),
        ]);

        expect(wrapper.findAll("[role=\"switch\"]")).toHaveLength(2);
    });

    it("says how to start while the current site carries no rule, whatever else is listed", async () => {
        const wrapper = await open("http://a.example/", [ruleBuild("localhost:3000")]);

        expect(wrapper.text()).toContain("start with the site you are on");
    });

    it("opens the options page from Manage rules, then shuts itself", async () => {
        const openOptions = vi.fn();
        const close = vi.spyOn(window, "close").mockImplementation(() => undefined);

        vi.spyOn(testBrowser.runtime, "openOptionsPage").mockImplementation(async () => {
            openOptions();

            expect(close).not.toHaveBeenCalled();

            await Promise.resolve();
        });

        const wrapper = await open("http://localhost:3000/");

        await press(wrapper, "Manage rules");

        expect(openOptions).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
    });

    it("stays open and says so when the options page refuses", async () => {
        const close = vi.spyOn(window, "close").mockImplementation(() => undefined);

        vi.spyOn(testBrowser.runtime, "openOptionsPage").mockRejectedValue(new Error("no"));

        const wrapper = await open("http://localhost:3000/");

        await press(wrapper, "Manage rules");

        expect(close).not.toHaveBeenCalled();
        expect(toasts.value.map(toast => toast.message)).toContain("The options page did not open. no");
    });
});
