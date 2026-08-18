<script setup lang="ts">
import BaseButton from "../../components/BaseButton.vue";
import BaseCheckbox from "../../components/BaseCheckbox.vue";
import BaseField from "../../components/BaseField.vue";
import BaseModal from "../../components/BaseModal.vue";
import BaseSelect from "../../components/BaseSelect.vue";
import { assert } from "../../assert";
import { computed, ref, watch } from "vue";
import {
    PROTOCOLS_DEFAULT,
    PROTOCOL_LABELS,
    RESOURCES_DEFAULT,
    RESOURCE_LABELS,
    RULE_NAME_LENGTH_MAX,
} from "../../constant";
import type { Protocol, ResourceType } from "../../constant";
import type { Rule } from "../../storage";
import type { SelectOption } from "../../components/BaseSelect.vue";

export interface RuleDraft {
    group: string;
    name: string;
    protocols: Protocol[];
    resources: ResourceType[];
    wildcard: boolean;
}

const { groups = [], rule, url } = defineProps<{ groups?: string[]; rule: Rule | undefined; url: string }>();

const emit = defineEmits<{
    close: [];
    save: [draft: RuleDraft];
}>();

const group = ref("");
const name = ref("");
const protocols = ref<Protocol[]>([]);
const resources = ref<ResourceType[]>([]);
const wildcard = ref(true);

const groupOptions = computed<SelectOption[]>(() => {
    const known = groups.some(value => value === group.value);
    const options = groups.map(value => ({ label: value, value }));

    if (group.value && !known) options.unshift({ label: group.value, value: group.value });

    return [{ label: "No group", value: "" }, ...options];
});

const resourcesSelectedCount = computed(() => RESOURCES_DEFAULT.filter(key => resources.value.includes(key)).length);

const resourcesAll = computed(() => resourcesSelectedCount.value === RESOURCES_DEFAULT.length);
const resourcesSome = computed(() => resourcesSelectedCount.value > 0 && !resourcesAll.value);

const changed = computed(() => {
    if (!rule) return true;

    return rule.wildcard !== wildcard.value
        || rule.group !== group.value.trim()
        || rule.name !== name.value.trim()
        || !membersSame(rule.protocols, protocols.value)
        || !membersSame(rule.resources, resources.value);
});

const error = computed(() => {
    if (resources.value.length === 0) return "Pick at least one resource, or the rule matches nothing.";
    if (protocols.value.length === 0) return "Pick at least one protocol, or the rule matches nothing.";

    return "";
});

function draftOf(source: Rule | undefined): RuleDraft {
    if (!source) {
        return {
            group: "",
            name: "",
            protocols: [...PROTOCOLS_DEFAULT],
            resources: [...RESOURCES_DEFAULT],
            wildcard: true,
        };
    }

    return {
        group: source.group,
        name: source.name,
        protocols: [...source.protocols],
        resources: [...source.resources],
        wildcard: source.wildcard,
    };
}

function membersSame(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;

    const known = new Set(left);

    return right.every(value => known.has(value));
}

function protocolToggle(key: Protocol, checked: boolean): void {
    protocols.value = checked ? [...protocols.value, key] : protocols.value.filter(value => value !== key);
}

function resourcesToggleAll(checked: boolean): void {
    resources.value = checked ? [...RESOURCES_DEFAULT] : [];
}

function resourceToggle(key: ResourceType, checked: boolean): void {
    resources.value = checked ? [...resources.value, key] : resources.value.filter(value => value !== key);
}

function ruleSave(): void {
    assert(resources.value.length > 0, "a saved draft names at least one resource");
    assert(protocols.value.length > 0, "a saved draft names at least one protocol");

    emit("save", {
        group: group.value.trim(),
        name: name.value.trim(),
        protocols: protocols.value,
        resources: resources.value,
        wildcard: wildcard.value,
    });
}

watch(
    () => url,
    () => {
        const draft = draftOf(rule);

        group.value = draft.group;
        name.value = draft.name;
        protocols.value = draft.protocols;
        resources.value = draft.resources;
        wildcard.value = draft.wildcard;
    },
    { immediate: true },
);
</script>

<template>
    <BaseModal :title="url" @close="emit('close')">
        <template #header>
            <p class="text-xs font-medium tracking-wide text-text-secondary uppercase">Rule</p>
            <p class="truncate font-mono text-sm">{{ url }}</p>
        </template>

        <div class="flex flex-col gap-6">
            <p
                v-if="error"
                role="alert"
                class="rounded-lg border border-danger bg-surface-1 px-4 py-3 text-xs text-danger"
            >
                {{ error }}
            </p>

            <section>
                <h3 class="mb-3 text-xs font-medium tracking-wide text-text-secondary uppercase">Name</h3>

                <BaseField
                    id="rule-name"
                    v-model="name"
                    hide-label
                    label="Name"
                    placeholder="A display name for this rule"
                    :maxlength="RULE_NAME_LENGTH_MAX"
                />
            </section>

            <section>
                <h3 class="mb-3 text-xs font-medium tracking-wide text-text-secondary uppercase">Group</h3>

                <BaseSelect
                    id="rule-group"
                    v-model="group"
                    hide-label
                    label="Group"
                    :options="groupOptions"
                />

                <p class="mt-2 text-xs text-text-secondary">
                    A rule belongs to one group, and the rules list draws a heading for each group. Groups are created
                    and renamed under Groups.
                </p>
            </section>

            <section>
                <h3 class="mb-3 text-xs font-medium tracking-wide text-text-secondary uppercase">Resources</h3>

                <BaseCheckbox
                    label="All resources"
                    :indeterminate="resourcesSome"
                    :model-value="resourcesAll"
                    @update:model-value="resourcesToggleAll"
                />

                <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                    <BaseCheckbox
                        v-for="key in RESOURCES_DEFAULT"
                        :key="key"
                        :label="RESOURCE_LABELS[key]"
                        :model-value="resources.includes(key)"
                        @update:model-value="resourceToggle(key, $event)"
                    />
                </div>
            </section>

            <section>
                <h3 class="mb-3 text-xs font-medium tracking-wide text-text-secondary uppercase">Protocols</h3>

                <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                    <BaseCheckbox
                        v-for="key in PROTOCOLS_DEFAULT"
                        :key="key"
                        :label="PROTOCOL_LABELS[key]"
                        :model-value="protocols.includes(key)"
                        @update:model-value="protocolToggle(key, $event)"
                    />
                </div>
            </section>

            <section>
                <h3 class="mb-3 text-xs font-medium tracking-wide text-text-secondary uppercase">Matching</h3>

                <BaseCheckbox v-model="wildcard" label="Match every path under this URL" />
            </section>
        </div>

        <template #footer>
            <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
            <BaseButton variant="primary" :disabled="!changed || error !== ''" @click="ruleSave">Save</BaseButton>
        </template>
    </BaseModal>
</template>
