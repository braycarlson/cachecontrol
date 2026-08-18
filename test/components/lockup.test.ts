import BrandLockup from "../../src/components/BrandLockup.vue";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

describe("BrandLockup", () => {
    it("sets the wordmark as cache at the light weight and control at the bold one", () => {
        const spans = mount(BrandLockup).findAll("span span span");

        expect(spans.map(span => span.text())).toEqual(["cache", "control"]);
        expect(spans[0]?.classes()).toContain("font-normal");
        expect(spans[1]?.classes()).toContain("font-bold");
    });

    it("reads as one word rather than two", () => {
        expect(mount(BrandLockup).text()).toBe("cachecontrol");
    });

    it("announces the product name rather than the split wordmark", () => {
        const wrapper = mount(BrandLockup);

        expect(wrapper.attributes("role")).toBe("img");
        expect(wrapper.attributes("aria-label")).toBe("CacheControl");
    });

    it("scales the tile, the mark and the wordmark off the lockup's own ratios", () => {
        const wrapper = mount(BrandLockup, { props: { size: 72 } });
        const [, tile] = wrapper.findAll("span");

        expect(tile?.attributes("style")).toContain("width: 72px");
        expect(tile?.attributes("style")).toContain("border-radius: 14px");
        expect(wrapper.get("svg").attributes("width")).toBe("44");
        expect(wrapper.get("h1, span span:last-child").attributes("style")).toContain("font-size: 46px");
    });
});
