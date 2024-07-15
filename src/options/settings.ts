import browser from "webextension-polyfill";
import { Entry, getSettings, saveSettings, saveURL, toggleURL, removeURL } from "../storage";
import { PRESETS } from "../constant";
import { openModal } from "./modal";


const rules = document.getElementById("rules") as HTMLTableElement;
const enabled = document.getElementById("enabled") as HTMLInputElement;
const presetCheckboxes = document.querySelectorAll(".preset-checkbox") as NodeListOf<HTMLInputElement>;
const headers = document.querySelectorAll(".collapsible") as NodeListOf<HTMLElement>;


export async function updateSettings() {
    const settings = await getSettings();
    enabled.checked = settings.enabled;
    updateUrlList(settings.urls, settings.enabled);
    updatePresetCheckboxes(settings.urls);
}

async function updateUrlList(urls: Entry[], extensionEnabled: boolean) {
    rules.innerHTML = "";

    urls.forEach((entry) => {
        const row = document.createElement("tr");

        if (!entry.enabled) {
            row.classList.add("disabled-row");
        }

        const url = document.createElement("td");
        url.classList.add("py-2", "px-4", "text-text");
        url.textContent = entry.url;

        const enable = document.createElement("td");
        enable.classList.add("py-2", "px-4", "text-text");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add("url-enabled-checkbox");
        checkbox.checked = entry.enabled;
        checkbox.disabled = !extensionEnabled;

        checkbox.addEventListener("change", async () => {
            await toggleURL(entry.url, checkbox.checked);
            updateSettings();
        });

        enable.appendChild(checkbox);

        const wildcard = document.createElement("td");
        wildcard.classList.add("py-2", "px-4", "text-text");

        const wildcardCheckbox = document.createElement("input");
        wildcardCheckbox.type = "checkbox";
        wildcardCheckbox.classList.add("url-wildcard-checkbox");
        wildcardCheckbox.checked = entry.wildcard;

        wildcardCheckbox.addEventListener("change", async () => {
            const settings = await getSettings();
            const urlEntry = settings.urls.find(urlEntry => urlEntry.url === entry.url);
            if (urlEntry) {
                urlEntry.wildcard = wildcardCheckbox.checked;
                await saveSettings(settings);
                updateSettings();
            }
        });

        wildcard.appendChild(wildcardCheckbox);

        const resources = document.createElement("td");
        resources.classList.add("py-2", "px-4", "text-text");

        const resourcesButton = document.createElement("button");
        resourcesButton.innerHTML = '<img src="/icons/open-in-window-normal.svg" alt="Open" class="w-6 h-6">';
        resourcesButton.classList.add("mr-2", "py-1", "px-2", "text-accent", "hover:text-hover");

        resourcesButton.addEventListener("click", () => openModal(entry.url));

        resourcesButton.addEventListener("mouseover", () => {
            const imgElement = resourcesButton.querySelector("img");
            if (imgElement) {
                imgElement.src = "/icons/open-in-window-hover.svg";
            }
        });

        resourcesButton.addEventListener("mouseout", () => {
            const imgElement = resourcesButton.querySelector("img");
            if (imgElement) {
                imgElement.src = "/icons/open-in-window-normal.svg";
            }
        });

        resources.appendChild(resourcesButton);

        const action = document.createElement("td");
        action.classList.add("py-2", "px-4", "text-text");

        const remove = document.createElement("button");
        remove.innerHTML = '<img src="/icons/xmark-normal.svg" alt="Open" class="w-6 h-6">';
        remove.classList.add("text-2xl", "text-accent", "hover:text-hover", "py-1", "hover:text-accent");

        remove.addEventListener("click", async () => {
            await removeURL(entry.url);
            updateSettings();
        });

        remove.addEventListener("mouseover", () => {
            const imgElement = remove.querySelector("img");
            if (imgElement) {
                imgElement.src = "/icons/xmark-hover.svg";
            }
        });

        remove.addEventListener("mouseout", () => {
            const imgElement = remove.querySelector("img");
            if (imgElement) {
                imgElement.src = "/icons/xmark-normal.svg";
            }
        });

        action.appendChild(remove);

        row.appendChild(url);
        row.appendChild(enable);
        row.appendChild(wildcard);
        row.appendChild(resources);
        row.appendChild(action);
        rules.appendChild(row);
    });
}

async function updatePresetCheckboxes(urls: Entry[]) {
    presetCheckboxes.forEach((checkbox) => {
        checkbox.checked = urls.some(entry => entry.url === PRESETS[checkbox.id]);
    });
}

presetCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
        if (checkbox.checked) {
            await saveURL(PRESETS[checkbox.id]);
        } else {
            await removeURL(PRESETS[checkbox.id]);
        }

        browser.storage.local.set({ urls: (await getSettings()).urls });
        updateSettings();
    });
});

enabled.addEventListener("change", async () => {
    const settings = await getSettings();
    settings.enabled = enabled.checked;
    await saveSettings(settings);

    browser.storage.local.set({ enabled: settings.enabled });
    updateUrlList(settings.urls, settings.enabled);
});

updateSettings();

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        updateSettings();
    }
});

headers.forEach(header => {
    const section = header.nextElementSibling as HTMLElement;

    header.addEventListener("click", function () {
        this.classList.toggle("active");

        if (section.style.display === "block") {
            section.style.display = "none";
        } else {
            section.style.display = "block";
        }
    });
});

document.querySelectorAll(".collapsible").forEach((header, index) => {
    const section = header.nextElementSibling as HTMLElement;

    if (index !== 1) {
        header.classList.add("active");
        section.style.display = "block";
    } else {
        section.style.display = "none";
    }
});
