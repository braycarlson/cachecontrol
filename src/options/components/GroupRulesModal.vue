<script setup lang="ts">
import BaseButton from "../../components/BaseButton.vue";
import BaseCheckbox from "../../components/BaseCheckbox.vue";
import BaseChip from "../../components/BaseChip.vue";
import BaseField from "../../components/BaseField.vue";
import BaseModal from "../../components/BaseModal.vue";
import { computed, ref, watch } from "vue";
import type { Rule } from "../../storage";

const { group, rules } = defineProps<{ group: string; rules: Rule[] }>();

const emit = defineEmits<{
    close: [];
    save: [urls: string[]];
}>();

const chosen = ref<string[]>([]);
const query = ref("");

const rulesHeld = computed(() => rules.filter(rule => rule.group.toLowerCase() === group.toLowerCase()));

const rulesFiltered = computed(() => {
    const needle = query.value.trim().toLowerCase();

    if (!needle) return rules;

    return rules.filter(rule => rule.url.toLowerCase().includes(needle) || rule.name.toLowerCase().includes(needle));
});

const changed = computed(() => {
    const before = new Set(rulesHeld.value.map(rule => rule.url));

    if (before.size !== chosen.value.length) return true;

    return chosen.value.some(url => !before.has(url));
});

function rulesSave(): void {
    emit("save", rules.filter(rule => chosen.value.includes(rule.url)).map(rule => rule.url));
}

function ruleToggle(url: string, checked: boolean): void {
    chosen.value = checked ? [...chosen.value, url] : chosen.value.filter(value => value !== url);
}

watch(
    () => group,
    () => {
        chosen.value = rulesHeld.value.map(rule => rule.url);
        query.value = "";
    },
    { immediate: true },
);
</script>

<template>
    <BaseModal :title="`Rules in ${group}`" @close="emit('close')">
        <template #header>
            <p class="text-xs font-medium tracking-wide text-text-secondary uppercase">Rules in</p>
            <p class="truncate text-sm">{{ group }}</p>
        </template>

        <BaseField
            id="group-rules-search"
            v-model="query"
            hide-label
            icon="search"
            label="Search rules"
            placeholder="Filter by URL or name"
            class="mb-4"
            @keydown.esc="query = ''"
        />

        <div class="max-h-72 overflow-y-auto rounded-lg border border-border px-3 py-2.5">
            <div v-if="rulesFiltered.length" class="flex flex-col gap-2.5">
                <div v-for="rule in rulesFiltered" :key="rule.url" class="flex items-center justify-between gap-3">
                    <BaseCheckbox
                        class="min-w-0"
                        :label="rule.name || rule.url"
                        :model-value="chosen.includes(rule.url)"
                        @update:model-value="ruleToggle(rule.url, $event)"
                    />

                    <BaseChip v-if="rule.group && rule.group !== group">{{ rule.group }}</BaseChip>
                </div>
            </div>

            <p v-else class="py-6 text-center text-sm text-text-secondary">
                <template v-if="rules.length === 0">There is no rule to put in a group yet.</template>
                <template v-else>No rule matches <span class="font-mono text-text-primary">{{ query.trim() }}</span>.</template>
            </p>
        </div>

        <p class="mt-4 text-xs text-text-secondary">
            A rule belongs to one group, so checking one here takes it out of the group it was in.
        </p>

        <template #footer>
            <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
            <BaseButton variant="primary" :disabled="!changed" @click="rulesSave">Save</BaseButton>
        </template>
    </BaseModal>
</template>
