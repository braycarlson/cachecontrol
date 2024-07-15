import browser from "webextension-polyfill";
import { updateSettings } from "./settings";
import { getSettings, saveSettings } from "../storage";
import { DEFAULTRESOURCES, DEFAULTPROTOCOLS } from "../constant";


const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("url") as HTMLInputElement;


form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = input.value.trim();

    if (url) {
        const settings = await getSettings();

        if (!settings.urls.find(entry => entry.url === url)) {
            settings.urls.push(
                {
                    url,
                    enabled: true,
                    resources: DEFAULTRESOURCES,
                    protocols: DEFAULTPROTOCOLS,
                    wildcard: true
                }
            );

            await saveSettings(settings);
        }

        input.value = "";

        browser.storage.local.set({ urls: settings.urls });
        updateSettings();
    }
});
