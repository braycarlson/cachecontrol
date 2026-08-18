import manifest from "../manifest.json";
import { RESOURCES_DEFAULT } from "../src/constant";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ICON_SIZES = ["16", "32", "48", "128"];

function iconPaths(): string[] {
    return [
        ...Object.values(manifest.icons),
        ...Object.values(manifest["{{firefox}}.browser_action"].default_icon),
        ...Object.values(manifest["{{chrome}}.action"].default_icon),
    ];
}

describe("the manifest template", () => {
    it("runs Manifest V2 on Firefox and Manifest V3 on Chrome", () => {
        expect(manifest["{{firefox}}.manifest_version"]).toBe(2);
        expect(manifest["{{chrome}}.manifest_version"]).toBe(3);
    });

    it("asks Firefox for blocking webRequest and nothing beyond it", () => {
        expect(manifest["{{firefox}}.permissions"]).toEqual([
            "webRequest",
            "webRequestBlocking",
            "storage",
            "<all_urls>",
        ]);
    });

    it("asks Chrome for declarativeNetRequest, with host access in its own key", () => {
        expect(manifest["{{chrome}}.permissions"]).toEqual(["declarativeNetRequest", "storage"]);
        expect(manifest["{{chrome}}.host_permissions"]).toEqual(["<all_urls>"]);
    });

    it("drops activeTab and the scheme wildcards <all_urls> already subsumes", () => {
        const asked = [
            ...manifest["{{firefox}}.permissions"],
            ...manifest["{{chrome}}.permissions"],
            ...manifest["{{chrome}}.host_permissions"],
        ];

        expect(asked).not.toContain("activeTab");
        expect(asked).not.toContain("*://*/*");
        expect(asked).not.toContain("http://*/*");
        expect(asked).not.toContain("https://*/*");
    });

    it("runs a persistent page on Firefox and a service worker on Chrome", () => {
        expect(manifest["{{firefox}}.background"]).toEqual({
            persistent: true,
            scripts: ["src/background/background.ts"],
        });

        expect(manifest["{{chrome}}.background"]).toEqual({
            service_worker: "src/background/background.ts",
        });
    });

    it("hangs the popup off the action key each manifest version names", () => {
        expect(manifest["{{firefox}}.browser_action"].default_popup).toBe("src/popup/index.html");
        expect(manifest["{{chrome}}.action"].default_popup).toBe("src/popup/index.html");
    });

    it("names the oldest browser that carries URL.canParse", () => {
        expect(manifest["{{firefox}}.browser_specific_settings"].gecko.strict_min_version).toBe("115.0");
        expect(manifest["{{chrome}}.minimum_chrome_version"]).toBe("120");
    });

    it("carries the gecko id the AMO listing is bound to", () => {
        expect(manifest["{{firefox}}.browser_specific_settings"].gecko.id).toBe("{67ff6b13-5c99-4f81-ba95-eebbc5be8f6f}");
    });

    it("declares to Firefox that it collects nothing", () => {
        expect(manifest["{{firefox}}.browser_specific_settings"].gecko.data_collection_permissions).toEqual({
            required: ["none"],
        });
    });

    it("keeps the Manifest V2 content security policy and lets Manifest V3 default", () => {
        expect(manifest["{{firefox}}.content_security_policy"]).toBe("script-src 'self'; object-src 'self';");
        expect(Object.hasOwn(manifest, "{{chrome}}.content_security_policy")).toBe(false);
    });

    it("declares every icon size at every place an icon is named", () => {
        expect(Object.keys(manifest.icons)).toEqual(ICON_SIZES);
        expect(Object.keys(manifest["{{firefox}}.browser_action"].default_icon)).toEqual(ICON_SIZES);
        expect(Object.keys(manifest["{{chrome}}.action"].default_icon)).toEqual(ICON_SIZES);
    });

    it("points every icon at a file the repository holds", () => {
        for (const path of iconPaths()) {
            expect(existsSync(resolve(import.meta.dirname, "..", "public", path))).toBe(true);
        }
    });
});

describe("the resource set", () => {
    it("names only types declarativeNetRequest also knows", () => {
        const declarative = [
            "main_frame",
            "sub_frame",
            "stylesheet",
            "script",
            "image",
            "object",
            "xmlhttprequest",
            "ping",
            "csp_report",
            "media",
            "websocket",
            "font",
            "other",
        ];

        for (const resource of RESOURCES_DEFAULT) expect(declarative).toContain(resource);
    });
});
