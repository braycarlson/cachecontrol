import { assert } from "../src/assert";
import { describe, expect, it } from "vitest";

describe("assert", () => {
    it("passes a condition that holds", () => {
        expect(() => {
            assert(true, "the list is within its count maximum");
        }).not.toThrow();
    });

    it("throws the message a failed condition carries", () => {
        expect(() => {
            assert(false, "the list is within its count maximum");
        }).toThrow("assert: the list is within its count maximum");
    });
});
