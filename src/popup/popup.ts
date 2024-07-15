import browser from "webextension-polyfill";
import { getSettings, saveSettings, saveURL } from "../storage";
import "../stylesheet/index.css";

const form = document.getElementById("form") as HTMLFormElement;
const rule = document.getElementById("url") as HTMLInputElement;
const enabled = document.getElementById("enabled") as HTMLInputElement;
const settings = document.getElementById("settings") as HTMLButtonElement;

async function update() {
    const settings = await getSettings();
    enabled.checked = settings.enabled;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = rule.value.trim();

    if (url) {
        await saveURL(url);
        rule.value = "";

        const settings = await getSettings();
        browser.storage.local.set({ urls: settings.urls });

        update();
    }
});

enabled.addEventListener("change", async () => {
    const settings = await getSettings();
    settings.enabled = enabled.checked;

    await saveSettings(settings);
    browser.storage.local.set({ enabled: settings.enabled });
});

settings.addEventListener("click", () => {
    browser.runtime.openOptionsPage();
});

update();

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        update();
    }
});
