import browser from "webextension-polyfill";
import { getSettings, saveSettings, saveURL, removeURL, toggleURL, Entry } from "../storage";
import "../stylesheet/index.css";

const form = document.getElementById("form") as HTMLFormElement;
const input = document.getElementById("url") as HTMLInputElement;
const rules = document.getElementById("rules") as HTMLTableElement;
const wildcard = document.getElementById("wildcard") as HTMLInputElement;
const enabled = document.getElementById("enabled") as HTMLInputElement;
const presetCheckboxes = document.querySelectorAll(".preset-checkbox") as NodeListOf<HTMLInputElement>;
const resourceCheckboxes = document.querySelectorAll(".resource-checkbox") as NodeListOf<HTMLInputElement>;
const all = document.getElementById("all") as HTMLInputElement;

const presets: { [key: string]: string } = {
    react3000: "http://localhost:3000",
    react3001: "http://localhost:3001",
    jupyter8888: "http://localhost:8888",
    jupyter8889: "http://localhost:8889",
    node3002: "http://localhost:3002",
    node3003: "http://localhost:3003",
    docker5000: "http://localhost:5000",
    docker5001: "http://localhost:5001",
    angular4200: "http://localhost:4200",
    angular4201: "http://localhost:4201"
};

async function updateSettings() {
    const settings = await getSettings();
    wildcard.checked = settings.wildcard;
    enabled.checked = settings.enabled;
    updateUrlList(settings.urls, settings.enabled);
    updatePresetCheckboxes(settings.urls);
    updateResourceCheckboxes(settings.resources);
}

async function updateUrlList(urls: Entry[], enabled: boolean) {
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
        checkbox.disabled = !enabled;

        checkbox.addEventListener("change", async () => {
            await toggleURL(entry.url, checkbox.checked);
            updateSettings();
        });

        enable.appendChild(checkbox);

        const action = document.createElement("td");
        action.classList.add("py-2", "px-4", "text-text");

        const remove = document.createElement("button");
        remove.innerHTML = "&times;";

        remove.classList.add(
            "text-2xl",
            "text-accent",
            "hover:text-hover",
            "py-1",
            "hover:text-accent"
        );

        remove.addEventListener("click", async () => {
            await removeURL(entry.url);
            updateSettings();
        });

        action.appendChild(remove);
        row.appendChild(url);
        row.appendChild(enable);
        row.appendChild(action);
        rules.appendChild(row);
    });
}

async function updatePresetCheckboxes(urls: Entry[]) {
    presetCheckboxes.forEach((checkbox) => {
        checkbox.checked = urls.some(entry => entry.url === presets[checkbox.id]);
    });
}

async function updateResourceCheckboxes(resources: string[]) {
    resourceCheckboxes.forEach((checkbox) => {
        checkbox.checked = resources.includes(checkbox.id);
    });

    all.checked = resourceCheckboxes.length === resources.length;
}

presetCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
        if (checkbox.checked) {
            await saveURL(presets[checkbox.id]);
        } else {
            await removeURL(presets[checkbox.id]);
        }

        browser.storage.local.set({ urls: (await getSettings()).urls });
        updateSettings();
    });
});

resourceCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
        const settings = await getSettings();

        if (checkbox.checked) {
            settings.resources.push(checkbox.id);
        } else {
            settings.resources = settings.resources.filter(resource => resource !== checkbox.id);
        }

        await saveSettings(settings);
        updateResourceCheckboxes(settings.resources);
    });
});

all.addEventListener("change", async () => {
    const settings = await getSettings();

    if (all.checked) {
        settings.resources = Array.from(resourceCheckboxes).map(checkbox => checkbox.id);
    } else {
        settings.resources = [];
    }

    await saveSettings(settings);
    updateResourceCheckboxes(settings.resources);
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const url = input.value.trim();

    if (url) {
        await saveURL(url);
        input.value = "";

        const settings = await getSettings();
        browser.storage.local.set({ urls: settings.urls });

        updateSettings();
    }
});

wildcard.addEventListener("change", async () => {
    const settings = await getSettings();
    settings.wildcard = wildcard.checked;
    await saveSettings(settings);

    browser.storage.local.set({ wildcard: settings.wildcard });
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

const headers = document.querySelectorAll(".collapsible") as NodeListOf<HTMLElement>;

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
