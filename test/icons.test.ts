import { ICONS, STROKE_WIDTHS } from "../src/components/icons";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ASSETS = resolve(import.meta.dirname, "..", "assets");

function asset(name: string): string {
    return readFileSync(resolve(ASSETS, name), "utf8");
}

function paths(svg: string): string[] {
    return [...svg.matchAll(/\sd="([^"]+)"/gu)].map(([, value]) => value ?? "").sort();
}

function strokeWidths(svg: string): string[] {
    return [...new Set([...svg.matchAll(/\sstroke-width="([^"]+)"/gu)].map(([, value]) => value ?? ""))];
}

describe("the brand mark", () => {
    it("draws every path the mark asset carries and no other", () => {
        expect([...ICONS.mark].sort()).toEqual(paths(asset("cachecontrol-mark.svg")));
    });

    it("draws the same paths the lockup carries", () => {
        expect([...ICONS.mark].sort()).toEqual(paths(asset("cachecontrol-lockup-on-dark.svg")));
    });

    it("strokes at the weight both assets draw with", () => {
        const weight = [String(STROKE_WIDTHS.mark)];

        expect(strokeWidths(asset("cachecontrol-mark.svg"))).toEqual(weight);
        expect(strokeWidths(asset("cachecontrol-lockup-on-dark.svg"))).toEqual(weight);
    });
});
