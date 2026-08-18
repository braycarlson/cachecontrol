import { expect, test } from "@playwright/test";
import { extensionLoad, seed } from "../extension";
import type { Loaded } from "../extension";

interface StorageApi {
    storage: { local: { get: (keys: string[]) => Promise<Record<string, unknown>> } };
}

const PRESET = "localhost:3000, 127.0.0.1:3000";

let loaded: Loaded;

async function open(section: string, rules: Parameters<typeof seed>[1], groups: string[] = []): Promise<void> {
    await seed(loaded, rules, true, groups);
    await loaded.privileged.reload();
    await loaded.privileged.getByRole("button", { exact: true, name: section }).click();
}

async function openRules(rules: Parameters<typeof seed>[1], groups: string[] = []): Promise<void> {
    await open("Rules", rules, groups);
}

async function storedGroups(): Promise<string[]> {
    return loaded.privileged.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: StorageApi }).chrome;
        const values = await api.storage.local.get(["groups"]);

        return (values["groups"] ?? []) as string[];
    });
}

async function storedUrls(): Promise<string[]> {
    return loaded.privileged.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: StorageApi }).chrome;
        const values = await api.storage.local.get(["rules"]);

        return ((values["rules"] ?? []) as { url: string }[]).map(rule => rule.url);
    });
}

test.beforeAll(async () => {
    loaded = await extensionLoad();
});

test.afterAll(async () => {
    await loaded.close();
});

test("a preset writes a rule for localhost and for 127.0.0.1", async () => {
    await seed(loaded, []);
    await loaded.privileged.reload();

    await loaded.privileged.getByRole("button", { name: "Presets" }).click();
    await loaded.privileged.locator(`[title="${PRESET}"]`).click();

    await expect.poll(storedUrls, { timeout: 10_000 }).toEqual(["localhost:3000", "127.0.0.1:3000"]);

    await loaded.privileged.locator(`[title="${PRESET}"]`).click();

    await expect.poll(storedUrls, { timeout: 10_000 }).toEqual([]);
});

test("a group heads its rules, counts them, and closes", async () => {
    await openRules([
        { group: "Frontend", name: "Local React", url: "localhost:3000" },
        { group: "Frontend", url: "localhost:5173" },
        { url: "b.example" },
    ]);

    const heading = loaded.privileged.getByRole("heading", { name: "Frontend" });

    await expect(heading).toContainText("2");
    await expect(loaded.privileged.getByRole("heading", { name: "Ungrouped" })).toBeVisible();
    await expect(loaded.privileged.getByText("Local React")).toBeVisible();

    await heading.getByRole("button").click();

    await expect(loaded.privileged.getByText("Local React")).toBeHidden();
});

test("deleting a rule asks in a dialog first", async () => {
    await openRules([
        { url: "localhost:3000" },
        { url: "b.example" },
    ]);

    await loaded.privileged.getByLabel("Delete the rule for localhost:3000").click();
    await loaded.privileged.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await expect(loaded.privileged.getByRole("dialog")).toBeHidden();

    await loaded.privileged.getByLabel("Delete the rule for localhost:3000").click();
    await loaded.privileged.getByRole("dialog").getByRole("button", { name: "Delete rule" }).click();

    await expect.poll(storedUrls, { timeout: 10_000 }).toEqual(["b.example"]);
});

test("a group is created, renamed, and deleted from the groups section", async () => {
    await open("Groups", [{ url: "b.example" }]);

    await loaded.privileged.locator("#groups-name").fill("Frontend");
    await loaded.privileged.getByRole("button", { name: "Add group" }).click();

    await expect.poll(storedGroups, { timeout: 10_000 }).toEqual(["Frontend"]);

    await loaded.privileged.getByLabel("Rename the group Frontend").click();
    await loaded.privileged.locator("#group-name").fill("Backend");
    await loaded.privileged.getByRole("dialog").getByRole("button", { name: "Save" }).click();

    await expect.poll(storedGroups, { timeout: 10_000 }).toEqual(["Backend"]);

    await loaded.privileged.getByLabel("Delete the group Backend").click();
    await loaded.privileged.getByRole("dialog").getByRole("button", { name: "Delete group" }).click();

    await expect.poll(storedGroups, { timeout: 10_000 }).toEqual([]);
});

test("deleting a group keeps its rules and ungroups them", async () => {
    await open("Groups", [
        { group: "Frontend", url: "localhost:3000" },
        { url: "b.example" },
    ], ["Frontend"]);

    await loaded.privileged.getByLabel("Delete the group Frontend").click();

    await expect(loaded.privileged.getByRole("dialog")).toContainText("moves them to Ungrouped");

    await loaded.privileged.getByRole("dialog").getByRole("button", { name: "Delete group" }).click();

    await expect.poll(storedGroups, { timeout: 10_000 }).toEqual([]);
    await expect.poll(storedUrls, { timeout: 10_000 }).toEqual(["localhost:3000", "b.example"]);
});

test("a rule is dragged from one group into another", async () => {
    await openRules([
        { group: "Frontend", url: "localhost:3000" },
        { url: "b.example" },
    ], ["Backend", "Frontend"]);

    await loaded.privileged.locator("[title=\"Drag b.example into a group\"]")
        .dragTo(loaded.privileged.locator("[data-section=\"Backend\"]"));

    await expect(loaded.privileged.locator("[data-section=\"Backend\"]")).toContainText("b.example");
    await expect.poll(storedGroups, { timeout: 10_000 }).toEqual(["Backend", "Frontend"]);

    const groups = await loaded.privileged.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: StorageApi }).chrome;
        const values = await api.storage.local.get(["rules"]);

        return ((values["rules"] ?? []) as { group: string; url: string }[]).map(rule => `${rule.url}:${rule.group}`);
    });

    expect(groups).toEqual(["localhost:3000:Frontend", "b.example:Backend"]);
});

test("several rules go into a group at once from the groups section", async () => {
    await open("Groups", [
        { url: "localhost:3000" },
        { url: "localhost:5173" },
        { url: "b.example" },
    ], ["Frontend"]);

    await loaded.privileged.getByLabel("Choose the rules in Frontend").click();

    for (const url of ["localhost:3000", "localhost:5173"]) {
        await loaded.privileged.getByRole("dialog").getByText(url, { exact: true }).click();
    }

    await loaded.privileged.getByRole("dialog").getByRole("button", { name: "Save" }).click();

    await expect(loaded.privileged.getByRole("dialog")).toBeHidden();

    const held = await loaded.privileged.evaluate(async () => {
        const api = (globalThis as unknown as { chrome: StorageApi }).chrome;
        const values = await api.storage.local.get(["rules"]);

        return ((values["rules"] ?? []) as { group: string; url: string }[])
            .filter(rule => rule.group === "Frontend")
            .map(rule => rule.url);
    });

    expect(held).toEqual(["localhost:3000", "localhost:5173"]);
});

test("a rule takes a name and a group from the modal", async () => {
    await openRules([{ url: "b.example" }], ["Backend"]);

    await loaded.privileged.getByLabel("Edit the rule for b.example").click();
    await loaded.privileged.locator("#rule-name").fill("Staging API");
    await loaded.privileged.locator("#rule-group").selectOption("Backend");
    await loaded.privileged.getByRole("button", { name: "Save" }).click();

    await expect(loaded.privileged.getByRole("heading", { name: "Backend" })).toBeVisible();
    await expect(loaded.privileged.getByText("Staging API")).toBeVisible();
});
