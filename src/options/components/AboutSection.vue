<script setup lang="ts">
import BaseIcon from "../../components/BaseIcon.vue";
import BrandLockup from "../../components/BrandLockup.vue";
import browser from "webextension-polyfill";
import { REPOSITORY_URL } from "../../constant";

const { manifest_version: manifest, version } = browser.runtime.getManifest();

const facts = [
    { label: "Version", value: version },
    { label: "Manifest", value: `V${manifest}` },
    { label: "Engine", value: manifest === 3 ? "declarativeNetRequest" : "webRequest" },
];
</script>

<template>
    <section>
        <div class="rounded-lg border border-border bg-surface-1 px-4 py-4">
            <div class="flex flex-col gap-2">
                <BrandLockup :size="28" />

                <p class="text-xs text-text-secondary">
                    An extension that disables the browser cache for the sites you name.
                </p>
            </div>

            <dl class="mt-4 divide-y divide-border border-t border-border">
                <div v-for="fact in facts" :key="fact.label" class="flex items-baseline justify-between gap-4 py-2">
                    <dt class="text-xs text-text-secondary">{{ fact.label }}</dt>
                    <dd class="font-mono text-xs">{{ fact.value }}</dd>
                </div>
            </dl>

            <a
                :href="REPOSITORY_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
                View on GitHub
                <BaseIcon name="external" :size="12" />
            </a>
        </div>
    </section>
</template>
