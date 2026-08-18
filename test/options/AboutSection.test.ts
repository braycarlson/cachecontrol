import AboutSection from "../../src/options/components/AboutSection.vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { REPOSITORY_URL } from "../../src/constant";
import { testBrowser } from "../browser";

type Wrapper = ReturnType<typeof mount<typeof AboutSection>>;

function open(manifest: number): Wrapper {
    vi.spyOn(testBrowser.runtime, "getManifest").mockReturnValue({
        manifest_version: manifest,
        name: "CacheControl",
        version: "1.2.3",
    });

    return mount(AboutSection);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("AboutSection", () => {
    it("reports the version and the manifest the build carries", () => {
        const text = open(2).text();

        expect(text).toContain("1.2.3");
        expect(text).toContain("V2");
    });

    it("names the blocking engine on manifest v2", () => {
        const text = open(2).text();

        expect(text).toContain("webRequest");
        expect(text).not.toContain("declarativeNetRequest");
    });

    it("names the declarative engine on manifest v3", () => {
        const text = open(3).text();

        expect(text).toContain("declarativeNetRequest");
        expect(text).toContain("V3");
    });

    it("links out to the repository in a new tab", () => {
        const link = open(2).get("a");

        expect(link.attributes("href")).toBe(REPOSITORY_URL);
        expect(link.attributes("target")).toBe("_blank");
        expect(link.attributes("rel")).toBe("noopener noreferrer");
    });
});
