import { afterEach, describe, expect, it, vi } from "vitest";
import { flush, withSetup } from "../helpers";
import { testBrowser } from "../browser";
import { useTabCurrent } from "../../src/composables/tab";
import type { TabCurrent } from "../../src/composables/tab";
import type { Tabs } from "webextension-polyfill";

async function open(url: string | null): Promise<TabCurrent> {
    const tabs = url === null ? [] : [{ url } as unknown as Tabs.Tab];

    vi.spyOn(testBrowser.tabs, "query").mockResolvedValue(tabs);

    const { result } = withSetup(useTabCurrent);

    await flush();

    return result;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("useTabCurrent", () => {
    it("reads the host and the origin of a secure tab", async () => {
        const tab = await open("https://example.com/app?x=1");

        expect(tab.host.value).toBe("example.com");
        expect(tab.origin.value).toBe("https://example.com");
        expect(tab.resolved.value).toBe(true);
    });

    it("reads the host and the origin of a plain tab carrying a port", async () => {
        const tab = await open("http://localhost:3000/index.html");

        expect(tab.host.value).toBe("localhost:3000");
        expect(tab.origin.value).toBe("http://localhost:3000");
    });

    it("resolves to nothing on an about page", async () => {
        const tab = await open("about:blank");

        expect(tab.host.value).toBe("");
        expect(tab.origin.value).toBe("");
        expect(tab.resolved.value).toBe(true);
    });

    it("resolves to nothing on an extension page", async () => {
        const tab = await open("moz-extension://abcdef/src/options/index.html");

        expect(tab.host.value).toBe("");
        expect(tab.resolved.value).toBe(true);
    });

    it("resolves to nothing when the window holds no tab", async () => {
        const tab = await open(null);

        expect(tab.host.value).toBe("");
        expect(tab.origin.value).toBe("");
        expect(tab.resolved.value).toBe(true);
    });

    it("resolves to nothing when the tab carries no address", async () => {
        vi.spyOn(testBrowser.tabs, "query").mockResolvedValue([{} as unknown as Tabs.Tab]);

        const { result } = withSetup(useTabCurrent);

        await flush();

        expect(result.host.value).toBe("");
        expect(result.resolved.value).toBe(true);
    });
});
