import { updateSettings } from "./settings";
import { getSettings, saveSettings } from "../storage";


const resourceModal = document.getElementById("resourceModal") as HTMLDivElement;
const modalUrlSpan = document.getElementById("modalUrl") as HTMLSpanElement;
const modalResourceCheckboxes = document.querySelectorAll(".modal-resource-checkbox") as NodeListOf<HTMLInputElement>;
const modalProtocolCheckboxes = document.querySelectorAll(".modal-protocol-checkbox") as NodeListOf<HTMLInputElement>;
const modalAllResourcesCheckbox = document.getElementById("modal_all_resources") as HTMLInputElement;
const modalSaveButton = document.getElementById("modalSave") as HTMLButtonElement;
const modalCancelButton = document.getElementById("modalCancel") as HTMLButtonElement;
const modalContent = document.querySelector(".modal-content") as HTMLDivElement;


let currentUrl: string = "";

export function openModal(url: string) {
    currentUrl = url;
    modalUrlSpan.textContent = url;
    resourceModal.classList.remove("hidden");

    getSettings().then(settings => {
        const entry = settings.urls.find(entry => entry.url === url);
        const resources = entry?.resources || [];
        const protocols = entry?.protocols || [];

        modalResourceCheckboxes.forEach(checkbox => {
            checkbox.checked = resources.length ? resources.includes(checkbox.id.replace("modal_", "")) : false;
        });

        modalProtocolCheckboxes.forEach(checkbox => {
            checkbox.checked = protocols.length ? protocols.includes(checkbox.id.replace("modal_", "")) : false;
        });

        updateAllResourcesCheckbox();
    });
}

// Function to close modal
function closeModal() {
    resourceModal.classList.add("hidden");
    currentUrl = "";
}

function updateAllResourcesCheckbox() {
    const checked = Array.from(modalResourceCheckboxes).every(checkbox => checkbox.checked);
    modalAllResourcesCheckbox.checked = checked;
}

resourceModal.addEventListener("click", (event) => {
    if (event.target === resourceModal) {
        closeModal();
    }
});

modalContent.addEventListener("click", (event) => {
    event.stopPropagation();
});

modalAllResourcesCheckbox.addEventListener("change", () => {
    const checked = modalAllResourcesCheckbox.checked;

    modalResourceCheckboxes.forEach(checkbox => {
        checkbox.checked = checked;
    });
});

modalResourceCheckboxes.forEach(checkbox => {
    checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
            updateAllResourcesCheckbox();
        } else {
            modalAllResourcesCheckbox.checked = false;
        }
    });
});

modalSaveButton.addEventListener("click", async () => {
    const resources = Array.from(modalResourceCheckboxes)
        .filter(checkbox => checkbox.checked && checkbox.id !== "modal_all_resources")
        .map(checkbox => checkbox.id.replace("modal_", ""));

    const protocols = Array.from(modalProtocolCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.id.replace("modal_", ""));

    const settings = await getSettings();
    const entry = settings.urls.find(entry => entry.url === currentUrl);

    if (entry) {
        entry.resources = resources;
        entry.protocols = protocols;
    } else {
        settings.urls.push(
            {
                url: currentUrl,
                enabled: true,
                resources: resources,
                protocols: protocols,
                wildcard: true
            }
        );
    }

    await saveSettings(settings);
    updateSettings();
    closeModal();
});

modalCancelButton.addEventListener("click", closeModal);
