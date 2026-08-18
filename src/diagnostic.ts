import browser from "webextension-polyfill";
import { assert } from "./assert";

const DIAGNOSTIC_KEY = "diagnostic";

const DIAGNOSTIC_UNKNOWN = "The browser gave no reason.";

export const DIAGNOSTIC_MESSAGE_LENGTH_MAX = 240;

export interface Diagnostic {
    message: string;
    timestampMs: number;
}

export async function diagnosticClear(): Promise<boolean> {
    try {
        await browser.storage.local.remove(DIAGNOSTIC_KEY);
    } catch {
        return false;
    }

    return true;
}

export async function diagnosticGet(): Promise<Diagnostic | null> {
    const stored = await browser.storage.local.get(DIAGNOSTIC_KEY);
    const diagnostic = diagnosticParse(stored[DIAGNOSTIC_KEY]);

    if (diagnostic === null) return null;

    assert(diagnostic.message !== "", "a diagnostic read back carries a message");
    assert(diagnostic.timestampMs >= 0, "a diagnostic read back carries a timestamp that is not negative");

    return diagnostic;
}

function diagnosticParse(value: unknown): Diagnostic | null {
    if (typeof value !== "object") return null;
    if (value === null) return null;
    if (!("message" in value)) return null;
    if (!("timestampMs" in value)) return null;

    return diagnosticParseFields(value.message, value.timestampMs);
}

function diagnosticParseFields(message: unknown, timestampMs: unknown): Diagnostic | null {
    if (typeof message !== "string") return null;
    if (message.trim() === "") return null;
    if (typeof timestampMs !== "number") return null;
    if (!Number.isInteger(timestampMs)) return null;
    if (timestampMs < 0) return null;

    const diagnostic = { message: message.slice(0, DIAGNOSTIC_MESSAGE_LENGTH_MAX), timestampMs };

    assert(diagnostic.message !== "", "a parsed diagnostic carries a message");
    assert(diagnostic.timestampMs >= 0, "a parsed diagnostic carries a timestamp that is not negative");

    return diagnostic;
}

export async function diagnosticSave(message: string): Promise<boolean> {
    assert(message.trim() !== "", "a diagnostic carries a message");

    const diagnostic: Diagnostic = {
        message: message.slice(0, DIAGNOSTIC_MESSAGE_LENGTH_MAX),
        timestampMs: Date.now(),
    };

    assert(diagnostic.message !== "", "a saved diagnostic carries a message");
    assert(
        diagnostic.message.length <= DIAGNOSTIC_MESSAGE_LENGTH_MAX,
        "a saved diagnostic is within its length maximum",
    );

    try {
        await browser.storage.local.set({ [DIAGNOSTIC_KEY]: diagnostic });
    } catch {
        return false;
    }

    return true;
}

export function errorDescribe(cause: unknown): string {
    const raw = messageRaw(cause).trim();

    if (raw === "") return DIAGNOSTIC_UNKNOWN;

    const message = raw.slice(0, DIAGNOSTIC_MESSAGE_LENGTH_MAX);

    assert(message !== "", "a described error carries a message");
    assert(message.length <= DIAGNOSTIC_MESSAGE_LENGTH_MAX, "a described error is within its length maximum");

    return message;
}

function messageRaw(cause: unknown): string {
    if (cause instanceof Error) return cause.message;
    if (typeof cause === "string") return cause;

    return "";
}
