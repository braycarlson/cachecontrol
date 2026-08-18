import { DIAGNOSTIC_MESSAGE_LENGTH_MAX, diagnosticClear, diagnosticGet, diagnosticSave, errorDescribe } from "../src/diagnostic";
import { describe, expect, it, vi } from "vitest";
import { testBrowser } from "./browser";

async function seed(value: unknown): Promise<void> {
    await testBrowser.storage.local.set({ diagnostic: value });
}

describe("errorDescribe", () => {
    it("reads the message an Error carries", () => {
        expect(errorDescribe(new Error("QuotaExceededError"))).toBe("QuotaExceededError");
    });

    it("reads a thrown string", () => {
        expect(errorDescribe("plain failure")).toBe("plain failure");
    });

    it("falls back when the cause says nothing", () => {
        expect(errorDescribe(undefined)).toBe("The browser gave no reason.");
        expect(errorDescribe(new Error(""))).toBe("The browser gave no reason.");
        expect(errorDescribe({ code: 7 })).toBe("The browser gave no reason.");
    });

    it("caps a long message at the maximum", () => {
        const message = errorDescribe(new Error("x".repeat(DIAGNOSTIC_MESSAGE_LENGTH_MAX + 50)));

        expect(message).toHaveLength(DIAGNOSTIC_MESSAGE_LENGTH_MAX);
    });
});

describe("diagnosticSave", () => {
    it("round-trips a record through storage", async () => {
        expect(await diagnosticSave("The browser refused the rule set.")).toBe(true);

        const diagnostic = await diagnosticGet();

        expect(diagnostic?.message).toBe("The browser refused the rule set.");
        expect(diagnostic?.timestampMs).toBeGreaterThan(0);
    });

    it("caps a long message at the maximum", async () => {
        await diagnosticSave("x".repeat(DIAGNOSTIC_MESSAGE_LENGTH_MAX + 50));

        expect((await diagnosticGet())?.message).toHaveLength(DIAGNOSTIC_MESSAGE_LENGTH_MAX);
    });

    it("crashes on a message that is blank once trimmed", async () => {
        await expect(diagnosticSave("   ")).rejects.toThrow("assert:");
    });

    it("reports that the record did not land when the write is refused", async () => {
        vi.spyOn(testBrowser.storage.local, "set").mockRejectedValue(new Error("QuotaExceededError"));

        expect(await diagnosticSave("something went wrong")).toBe(false);

        vi.restoreAllMocks();
    });
});

describe("diagnosticGet", () => {
    it("reads nothing when nothing was written", async () => {
        expect(await diagnosticGet()).toBeNull();
    });

    it("reads nothing from a record of the wrong shape", async () => {
        await seed("a string");

        expect(await diagnosticGet()).toBeNull();

        await seed(null);

        expect(await diagnosticGet()).toBeNull();

        await seed({ message: "only a message" });

        expect(await diagnosticGet()).toBeNull();

        await seed({ timestampMs: 1 });

        expect(await diagnosticGet()).toBeNull();
    });

    it("reads nothing from a record carrying bad fields", async () => {
        await seed({ message: 7, timestampMs: 1 });

        expect(await diagnosticGet()).toBeNull();

        await seed({ message: "  ", timestampMs: 1 });

        expect(await diagnosticGet()).toBeNull();

        await seed({ message: "fine", timestampMs: "soon" });

        expect(await diagnosticGet()).toBeNull();

        await seed({ message: "fine", timestampMs: 1.5 });

        expect(await diagnosticGet()).toBeNull();

        await seed({ message: "fine", timestampMs: -1 });

        expect(await diagnosticGet()).toBeNull();
    });
});

describe("diagnosticClear", () => {
    it("removes the record it finds", async () => {
        await diagnosticSave("something went wrong");

        expect(await diagnosticClear()).toBe(true);
        expect(await diagnosticGet()).toBeNull();
    });

    it("reports that the record stayed when the remove is refused", async () => {
        vi.spyOn(testBrowser.storage.local, "remove").mockRejectedValue(new Error("QuotaExceededError"));

        expect(await diagnosticClear()).toBe(false);

        vi.restoreAllMocks();
    });
});
