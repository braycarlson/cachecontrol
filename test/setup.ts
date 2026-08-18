import { beforeEach, vi } from "vitest";
import { testBrowserReset } from "./browser";

vi.mock("webextension-polyfill", async () => {
    const { testBrowser } = await import("./browser");

    return { default: testBrowser };
});

beforeEach(() => {
    testBrowserReset();
});
