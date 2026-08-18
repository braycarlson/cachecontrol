import { createApp } from "vue";
import { ruleCreate } from "../src/rules";
import { settingsSave } from "../src/storage";
import type { App } from "vue";
import type { Rule, Settings } from "../src/storage";

export interface Mounted<T> {
    result: T;
    unmount: () => void;
}

export async function flush(delayMs = 0): Promise<void> {
    await new Promise(resolve => {
        setTimeout(resolve, delayMs);
    });
}

export function ruleBuild(url: string, overrides: Partial<Rule> = {}): Rule {
    return { ...ruleCreate(url), ...overrides };
}

export function settingsBuild(rules: Rule[], enabled = true, groups: string[] = []): Settings {
    return { enabled, groups, rules };
}

export async function settingsSeed(rules: Rule[], enabled = true, groups: string[] = []): Promise<void> {
    await settingsSave(settingsBuild(rules, enabled, groups));
}

export function withSetup<T>(composable: () => T): Mounted<T> {
    const held: T[] = [];

    const app: App = createApp({
        setup: () => {
            held.push(composable());
        },
        // eslint-disable-next-line sort-keys -- vue/order-in-components puts setup above render
        render: () => null,
    });

    app.mount(document.createElement("div"));

    const [result] = held;

    if (result === undefined) throw new Error("The composable returned nothing.");

    function unmount(): void {
        app.unmount();
    }

    return { result, unmount };
}
