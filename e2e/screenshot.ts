import { extensionLoad, seed } from "./extension";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Loaded, SeedRule } from "./extension";
import type { Page } from "@playwright/test";

interface Shot {
    label: string;
    name: string;
}

const CANVAS = "#0c0d11";

const HEIGHT = 800;

const OUTPUT = resolve(import.meta.dirname, "..", "assets");

const POPUP_ZOOM = 2;

const SETTLE_MS = 350;

const WIDTH = 1280;

const DEMO_TAB = "https://localhost:5173/dashboard";

const GROUPS = [
    "Backend",
    "Docs",
    "Frontend",
];

const RULES: SeedRule[] = [
    { group: "Frontend", name: "Vite dev server", url: "localhost:5173" },
    { group: "Frontend", name: "Storybook", url: "localhost:6006" },
    { enabled: false, group: "Frontend", name: "Legacy webpack build", url: "localhost:8080" },
    { group: "Backend", name: "Django API", url: "localhost:8000" },
    { group: "Backend", name: "Staging API", url: "staging.example.com/api" },
    { group: "Docs", name: "Hugo preview", url: "localhost:1313" },
    { name: "Local sandbox", url: "127.0.0.1:3000" },
    { name: "Design prototype", resources: ["image", "stylesheet", "script"], url: "proto.example.com" },
];

const SECTIONS: Shot[] = [
    { label: "General", name: "general" },
    { label: "Rules", name: "rules" },
    { label: "Groups", name: "groups" },
    { label: "Presets", name: "presets" },
    { label: "About", name: "about" },
];

async function capture(page: Page, name: string): Promise<void> {
    const path = resolve(OUTPUT, `cachecontrol-screenshot-${name}.png`);

    await page.screenshot({ path });

    log(`  wrote assets/cachecontrol-screenshot-${name}.png  ${WIDTH}x${HEIGHT}`);
}

async function frame(page: Page, image: Buffer, name: string): Promise<void> {
    const source = `data:image/png;base64,${image.toString("base64")}`;

    await page.setContent(`
        <style>
            html, body { margin: 0; height: 100%; }
            body {
                align-items: center;
                background: ${CANVAS};
                display: flex;
                justify-content: center;
            }
            img {
                border: 1px solid #2c313c;
                border-radius: 12px;
                box-shadow: 0 32px 80px -20px rgb(0 0 0 / 0.75);
            }
        </style>
        <img src="${source}" alt="">
    `);

    await page.waitForTimeout(SETTLE_MS);
    await capture(page, name);
}

function log(line: string): void {
    process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
    await mkdir(OUTPUT, { recursive: true });

    const loaded = await extensionLoad();

    try {
        await seed(loaded, RULES, true, GROUPS);

        log("capturing the options page");

        await optionsShoot(loaded);

        log("capturing the popup");

        await popupShoot(loaded);
    } finally {
        await loaded.close();
    }

    log("done");
}

async function optionsShoot(loaded: Loaded): Promise<void> {
    const { privileged } = loaded;

    await privileged.setViewportSize({ height: HEIGHT, width: WIDTH });
    await privileged.emulateMedia({ colorScheme: "dark" });
    await privileged.reload();

    for (const section of SECTIONS) {
        await privileged.getByRole("button", { exact: true, name: section.label }).click();
        await privileged.waitForTimeout(SETTLE_MS);
        await capture(privileged, section.name);
    }

    await privileged.getByRole("button", { exact: true, name: "Rules" }).click();
    await privileged.getByLabel("Edit the rule for staging.example.com/api").click();
    await privileged.waitForTimeout(SETTLE_MS);
    await capture(privileged, "rule-editor");
}

async function popupShoot(loaded: Loaded): Promise<void> {
    const page = await loaded.context.newPage();

    await page.addInitScript(url => {
        const api = (globalThis as unknown as { chrome: { tabs: { query: unknown } } }).chrome;

        api.tabs.query = async (): Promise<{ url: string }[]> => Promise.resolve([{ url }]);
    }, DEMO_TAB);

    await page.setViewportSize({ height: 1000, width: 800 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`chrome-extension://${loaded.id}/src/popup/index.html`);
    await page.waitForTimeout(SETTLE_MS);

    await page.evaluate(scale => {
        document.documentElement.style.zoom = scale;
    }, String(POPUP_ZOOM));

    await page.waitForTimeout(SETTLE_MS);

    const shell = page.locator("body > div").first();
    const image = await shell.screenshot();

    await page.setViewportSize({ height: HEIGHT, width: WIDTH });
    await frame(page, image, "popup");
    await page.close();
}

await main();
