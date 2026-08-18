<script setup lang="ts">
import BaseButton from "../../components/BaseButton.vue";
import BaseChip from "../../components/BaseChip.vue";
import BaseConfirm from "../../components/BaseConfirm.vue";
import BaseField from "../../components/BaseField.vue";
import BaseIcon from "../../components/BaseIcon.vue";
import BaseList from "../../components/BaseList.vue";
import BaseSwitch from "../../components/BaseSwitch.vue";
import { computed, ref, watch } from "vue";
import { groupsMerge, ruleError } from "../../rules";
import { PROTOCOL_LABELS, RESOURCES_DEFAULT } from "../../constant";
import type { Rule } from "../../storage";

interface Section {
    group: string;
    key: string;
    label: string;
    rules: Rule[];
}

const { groups: groupNames = [], rules, skipped = 0 } = defineProps<{
    groups?: string[];
    rules: Rule[];
    skipped?: number;
}>();

const emit = defineEmits<{
    add: [url: string];
    assign: [url: string, group: string];
    configure: [url: string];
    remove: [url: string];
    toggle: [url: string, enabled: boolean];
}>();

const DRAG_IMAGE_OFFSET_PX = 16;

const error = ref("");
const query = ref("");
const ruleDragged = ref("");
const ruleRemoveTarget = ref("");
const sectionOverKey = ref<string | null>(null);
const sectionsCollapsed = ref(new Set<string>());
const url = ref("");

const notice = computed(() => {
    if (skipped === 0) return "";

    const subject = skipped === 1 ? "One rule is" : `${skipped} rules are`;

    return `${subject} not running. The browser refused the pattern the rule compiles to, so check the URL, the protocols, and the resources.`;
});

const rulesFiltered = computed(() => {
    const needle = query.value.trim().toLowerCase();

    if (!needle) return rules;

    return rules.filter(rule => ruleMatches(rule, needle));
});

const groups = computed(() => groupsMerge(groupNames, rules));

const headingsShown = computed(() => groups.value.length > 0);

const sections = computed<Section[]>(() => {
    const ungrouped = { group: "", key: "", label: "Ungrouped", rules: rulesFiltered.value.filter(rule => !rule.group) };

    if (!headingsShown.value) return [{ ...ungrouped, rules: rulesFiltered.value }];

    const needle = query.value.trim();

    const list: Section[] = groups.value
        .map(group => ({
            group,
            key: group.toLowerCase(),
            label: group,
            rules: rulesFiltered.value.filter(rule => rule.group.toLowerCase() === group.toLowerCase()),
        }))
        .filter(section => !needle || section.rules.length > 0);

    if (!needle || ungrouped.rules.length > 0) list.push(ungrouped);

    return list;
});

function dragEnd(): void {
    ruleDragged.value = "";
    sectionOverKey.value = null;
}

function dragStart(event: DragEvent, rule: Rule): void {
    const { dataTransfer } = event;

    ruleDragged.value = rule.url;

    if (!dataTransfer) return;

    dataTransfer.effectAllowed = "move";
    dataTransfer.setData("text/plain", rule.url);

    const row = event.target instanceof Element ? event.target.closest("li") : null;

    if (row) dataTransfer.setDragImage(row, DRAG_IMAGE_OFFSET_PX, row.clientHeight / 2);
}

function queryClear(): void {
    query.value = "";
}

function removeConfirm(): void {
    const target = ruleRemoveTarget.value;

    ruleRemoveTarget.value = "";

    emit("remove", target);
}

function ruleAdd(): void {
    error.value = ruleError(url.value, rules);

    if (error.value) return;

    emit("add", url.value.trim());

    url.value = "";
}

function ruleDrop(section: Section): void {
    const target = ruleDragged.value;

    dragEnd();

    const rule = rules.find(candidate => candidate.url === target);

    if (!rule || rule.group.toLowerCase() === section.key) return;

    emit("assign", rule.url, section.group);
}

function ruleMatches(rule: Rule, needle: string): boolean {
    return rule.url.toLowerCase().includes(needle)
        || rule.name.toLowerCase().includes(needle)
        || rule.group.toLowerCase().includes(needle);
}

function sectionIsOpen(key: string): boolean {
    return !sectionsCollapsed.value.has(key);
}

function sectionLeave(key: string): void {
    if (sectionOverKey.value === key) sectionOverKey.value = null;
}

function sectionOver(event: DragEvent, key: string): void {
    if (!ruleDragged.value) return;

    event.preventDefault();

    const { dataTransfer } = event;

    if (dataTransfer) dataTransfer.dropEffect = "move";

    sectionOverKey.value = key;
}

function sectionToggle(key: string): void {
    const next = new Set(sectionsCollapsed.value);

    if (!next.delete(key)) next.add(key);

    sectionsCollapsed.value = next;
}

function urlClear(): void {
    error.value = "";
    url.value = "";
}

watch(query, () => {
    sectionsCollapsed.value = new Set();
    dragEnd();
    ruleRemoveTarget.value = "";
});

watch(() => rules.length, count => {
    dragEnd();
    ruleRemoveTarget.value = "";

    if (count === 0) query.value = "";
});

watch(url, () => {
    error.value = "";
});
</script>

<template>
    <section>
        <div
            class="grid transition-[grid-template-rows] duration-150 ease-out"
            :class="rules.length ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
            <div
                class="overflow-hidden transition-opacity duration-150 ease-out"
                :class="rules.length ? 'opacity-100' : 'opacity-0'"
                :inert="rules.length === 0"
            >
                <BaseField
                    id="rules-search"
                    v-model="query"
                    hide-label
                    icon="search"
                    label="Search rules"
                    placeholder="Filter by URL, name, or group"
                    class="mb-6"
                    @keydown.esc="queryClear"
                />
            </div>
        </div>

        <div class="mb-6 rounded-lg border border-border bg-surface-1 px-4 py-3">
            <p class="text-sm font-medium">Add a rule</p>

            <div class="mt-2 flex items-start gap-3">
                <BaseField
                    id="rules-url"
                    v-model="url"
                    hide-label
                    mono
                    label="URL"
                    placeholder="localhost:3000"
                    class="flex-1"
                    :error="error"
                    @keydown.enter="ruleAdd"
                    @keydown.esc="urlClear"
                />

                <BaseButton variant="primary" @click="ruleAdd">
                    <BaseIcon name="plus" :size="16" />
                    Add rule
                </BaseButton>
            </div>
        </div>

        <p v-if="notice" role="alert" class="mb-4 rounded-lg border border-danger bg-surface-1 px-4 py-3 text-xs text-danger">
            {{ notice }}
        </p>

        <div class="flex flex-col gap-6">
            <div
                v-for="section in sections"
                :key="section.key"
                class="rounded-lg border border-transparent transition-colors duration-150 ease-out"
                :class="ruleDragged && sectionOverKey === section.key ? 'border-dashed border-accent' : ''"
                :data-section="section.label"
                @dragover="sectionOver($event, section.key)"
                @dragleave="sectionLeave(section.key)"
                @drop.prevent="ruleDrop(section)"
            >
                <div v-if="headingsShown" class="mb-2 flex items-center gap-2">
                    <h3 class="min-w-0 flex-1">
                        <button
                            type="button"
                            class="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-left text-xs font-medium tracking-wide text-text-secondary uppercase transition-colors duration-150 ease-out hover:text-text-primary"
                            :aria-expanded="sectionIsOpen(section.key)"
                            @click="sectionToggle(section.key)"
                        >
                            <BaseIcon
                                name="chevron"
                                class="shrink-0 transition-transform duration-150 ease-out"
                                :class="sectionIsOpen(section.key) ? '' : '-rotate-90'"
                                :size="14"
                            />

                            <span class="truncate">{{ section.label }}</span>

                            <BaseChip>{{ section.rules.length }}</BaseChip>
                        </button>
                    </h3>
                </div>

                <BaseList v-if="sectionIsOpen(section.key)" class="flex flex-col gap-2">
                    <li
                        v-for="rule in section.rules"
                        :key="rule.url"
                        class="flex items-center gap-4 rounded-lg border bg-surface-1 py-3 pr-4 transition-opacity duration-150 ease-out"
                        :class="[
                            rule.enabled ? 'border-border' : 'border-surface-2',
                            headingsShown ? 'pl-2' : 'pl-4',
                            ruleDragged === rule.url ? 'opacity-40' : '',
                        ]"
                    >
                        <span
                            v-if="headingsShown"
                            aria-hidden="true"
                            draggable="true"
                            class="shrink-0 cursor-grab text-text-secondary transition-colors duration-150 ease-out hover:text-text-primary active:cursor-grabbing"
                            :title="`Drag ${rule.url} into a group`"
                            @dragstart="dragStart($event, rule)"
                            @dragend="dragEnd"
                        >
                            <BaseIcon name="grip" :size="18" />
                        </span>

                        <div class="min-w-0 flex-1">
                            <p v-if="rule.name" class="truncate text-sm font-medium">{{ rule.name }}</p>

                            <p class="truncate font-mono" :class="rule.name ? 'text-xs text-text-secondary' : 'text-sm'">
                                {{ rule.url }}
                            </p>

                            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <BaseChip v-for="protocol in rule.protocols" :key="protocol">
                                    {{ PROTOCOL_LABELS[protocol] }}
                                </BaseChip>

                                <BaseChip>{{ rule.resources.length }}/{{ RESOURCES_DEFAULT.length }} resources</BaseChip>

                                <BaseChip v-if="rule.wildcard">Wildcard</BaseChip>
                            </div>
                        </div>

                        <div class="flex shrink-0 items-center gap-1">
                            <BaseSwitch
                                class="mr-2"
                                :model-value="rule.enabled"
                                :label="`Enable the rule for ${rule.url}`"
                                @update:model-value="emit('toggle', rule.url, $event)"
                            />

                            <BaseButton
                                size="sm"
                                variant="ghost"
                                :aria-label="`Edit the rule for ${rule.url}`"
                                @click="emit('configure', rule.url)"
                            >
                                <BaseIcon name="pencil" :size="16" />
                            </BaseButton>

                            <BaseButton
                                size="sm"
                                variant="ghost"
                                :aria-label="`Delete the rule for ${rule.url}`"
                                @click="ruleRemoveTarget = rule.url"
                            >
                                <BaseIcon name="trash" :size="16" />
                            </BaseButton>
                        </div>
                    </li>
                </BaseList>

                <p
                    v-if="headingsShown && sectionIsOpen(section.key) && section.rules.length === 0"
                    class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-text-secondary"
                >
                    <template v-if="section.group">Drag a rule here to put it in {{ section.label }}.</template>
                    <template v-else>Drag a rule here to take it out of its group.</template>
                </p>
            </div>
        </div>

        <Transition
            mode="out-in"
            enter-active-class="transition-opacity delay-150 duration-150 ease-out"
            enter-from-class="opacity-0"
        >
            <p v-if="rules.length === 0" key="empty" class="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                No rules yet. Add a URL above, or turn one on under Presets.
            </p>

            <p v-else-if="rulesFiltered.length === 0" key="unmatched" class="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                No rule matches <span class="font-mono text-text-primary">{{ query.trim() }}</span>.
            </p>
        </Transition>

        <BaseConfirm
            v-if="ruleRemoveTarget"
            confirm-label="Delete rule"
            :title="`Delete ${ruleRemoveTarget}?`"
            @cancel="ruleRemoveTarget = ''"
            @confirm="removeConfirm"
        >
            The rule for {{ ruleRemoveTarget }} goes for good, and the browser caches that URL the way it decides.
        </BaseConfirm>
    </section>
</template>
