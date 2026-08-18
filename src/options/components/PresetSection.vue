<script setup lang="ts">
import BaseChip from "../../components/BaseChip.vue";
import { canonical, presetUrls } from "../../rules";
import { computed } from "vue";
import { GROUPS_PRESET } from "../../constant";
import type { PresetGroup } from "../../constant";
import type { Rule } from "../../storage";

interface Preset {
    active: boolean;
    label: string;
    title: string;
    urls: string[];
}

const { rules } = defineProps<{ rules: Rule[] }>();

const emit = defineEmits<{ toggle: [urls: string[], active: boolean] }>();

const urlsExisting = computed(() => new Set(rules.map(rule => canonical(rule.url))));

function presetOf(group: PresetGroup, port: number): Preset {
    const urls = presetUrls(port);

    return {
        active: urls.every(url => urlsExisting.value.has(canonical(url))),
        label: `${group.label} :${port}`,
        title: urls.map(canonical).join(", "),
        urls,
    };
}

const presets = computed<Preset[]>(
    () => GROUPS_PRESET.flatMap(group => group.ports.map(port => presetOf(group, port))),
);
</script>

<template>
    <section>
        <p class="mb-6 text-sm text-text-secondary">
            Each preset covers one development server port, on localhost and on 127.0.0.1. The preset adds both rules when you turn it on, and deletes them when you turn it off.
        </p>

        <div class="flex flex-wrap gap-2">
            <BaseChip
                v-for="preset in presets"
                :key="preset.title"
                interactive
                :active="preset.active"
                :title="preset.title"
                @toggle="emit('toggle', preset.urls, !preset.active)"
            >
                {{ preset.label }}
            </BaseChip>
        </div>
    </section>
</template>
