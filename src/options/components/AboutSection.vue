<script setup lang="ts">
import BaseIcon from "../../components/BaseIcon.vue";
import browser from "webextension-polyfill";

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
            <div class="flex items-center gap-3">
                <BaseIcon name="mark" class="shrink-0 text-accent" :size="24" />

                <div class="min-w-0">
                    <p class="text-sm font-medium">CacheControl</p>

                    <p class="text-xs text-text-secondary">
                        An extension that disables the browser cache for the sites you name.
                    </p>
                </div>
            </div>

            <dl class="mt-4 divide-y divide-border border-t border-border">
                <div v-for="fact in facts" :key="fact.label" class="flex items-baseline justify-between gap-4 py-2">
                    <dt class="text-xs text-text-secondary">{{ fact.label }}</dt>
                    <dd class="font-mono text-xs">{{ fact.value }}</dd>
                </div>
            </dl>
        </div>
    </section>
</template>
