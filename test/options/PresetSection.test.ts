import PresetSection from "../../src/options/components/PresetSection.vue";
import { GROUPS_PRESET } from "../../src/constant";
import { ruleBuild } from "../helpers";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import type { Rule } from "../../src/storage";

type Wrapper = ReturnType<typeof mount<typeof PresetSection>>;

function chip(wrapper: Wrapper, port: number): ReturnType<Wrapper["get"]> {
    return wrapper.get(`[title="${title(port)}"]`);
}

function open(rules: Rule[] = []): Wrapper {
    return mount(PresetSection, { props: { rules } });
}

function title(port: number): string {
    return `localhost:${port}, 127.0.0.1:${port}`;
}

describe("PresetSection", () => {
    it("draws one chip per preset port", () => {
        const total = GROUPS_PRESET.reduce((count, group) => count + group.ports.length, 0);

        expect(open().findAll("button")).toHaveLength(total);
    });

    it("gives every preset a port of its own", () => {
        const ports = GROUPS_PRESET.flatMap(group => group.ports);

        expect(new Set(ports).size).toBe(ports.length);
    });

    it("labels a chip with its group and its port", () => {
        expect(chip(open(), 3000).text()).toBe("React :3000");
    });

    it("reads a chip as inactive when no rule covers it", () => {
        expect(chip(open(), 3000).attributes("aria-pressed")).toBe("false");
    });

    it("reads a chip as inactive when one of its hosts is uncovered", () => {
        expect(chip(open([ruleBuild("localhost:3000")]), 3000).attributes("aria-pressed")).toBe("false");
    });

    it("reads a chip as active when a rule spelled another way covers each host", () => {
        const wrapper = open([ruleBuild("localhost:3000"), ruleBuild("http://127.0.0.1:3000")]);

        expect(chip(wrapper, 3000).attributes("aria-pressed")).toBe("true");
        expect(chip(wrapper, 3001).attributes("aria-pressed")).toBe("false");
    });

    it("reads a chip as active when the stored url was never canonicalized", () => {
        const wrapper = open([
            { ...ruleBuild("localhost:8888"), url: "HTTP://LOCALHOST:8888/" },
            { ...ruleBuild("127.0.0.1:8888"), url: "HTTP://127.0.0.1:8888/" },
        ]);

        expect(chip(wrapper, 8888).attributes("aria-pressed")).toBe("true");
    });

    it("asks for both hosts to be added when the preset is off", async () => {
        const wrapper = open();

        await chip(wrapper, 4200).trigger("click");

        expect(wrapper.emitted("toggle")).toEqual([[["http://localhost:4200", "http://127.0.0.1:4200"], true]]);
    });

    it("asks for both hosts to be removed when the preset is on", async () => {
        const wrapper = open([ruleBuild("localhost:4200"), ruleBuild("127.0.0.1:4200")]);

        await chip(wrapper, 4200).trigger("click");

        expect(wrapper.emitted("toggle")).toEqual([[["http://localhost:4200", "http://127.0.0.1:4200"], false]]);
    });
});
