import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToast } from "../../src/composables/toast";

const { dismiss, notify, toasts } = useToast();

beforeEach(() => {
    toasts.value = [];

    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useToast", () => {
    it("defaults to the success variant", () => {
        notify("Rule added");

        expect(toasts.value).toEqual([{ id: expect.any(Number) as number, message: "Rule added", variant: "success" }]);
    });

    it("carries the variant it was handed", () => {
        notify("The change was not saved.", "error");

        expect(toasts.value[0]?.variant).toBe("error");
    });

    it("keeps only the three most recent", () => {
        for (const message of ["one", "two", "three", "four"]) notify(message);

        expect(toasts.value.map(toast => toast.message)).toEqual(["two", "three", "four"]);
    });

    it("dismisses by id", () => {
        notify("one");
        notify("two");

        const [first] = toasts.value;

        dismiss(first?.id ?? 0);

        expect(toasts.value.map(toast => toast.message)).toEqual(["two"]);
    });

    it("ignores an id it does not hold", () => {
        notify("one");

        dismiss(-1);

        expect(toasts.value).toHaveLength(1);
    });

    it("expires on the timer", () => {
        notify("one");

        vi.advanceTimersByTime(2399);

        expect(toasts.value).toHaveLength(1);

        vi.advanceTimersByTime(1);

        expect(toasts.value).toHaveLength(0);
    });

    it("issues a unique id across rapid calls", () => {
        for (let index = 0; index < 32; index += 1) notify(`message ${index}`);

        const seen = new Set(toasts.value.map(toast => toast.id));

        expect(seen.size).toBe(toasts.value.length);
    });
});
