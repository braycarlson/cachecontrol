<script setup lang="ts">
import AboutSection from "./components/AboutSection.vue";
import BaseButton from "../components/BaseButton.vue";
import BaseIcon from "../components/BaseIcon.vue";
import BaseToast from "../components/BaseToast.vue";
import GeneralSection from "./components/GeneralSection.vue";
import GroupsSection from "./components/GroupsSection.vue";
import PresetSection from "./components/PresetSection.vue";
import RuleModal from "./components/RuleModal.vue";
import RulesSection from "./components/RulesSection.vue";
import { canonical, groupsSort, ruleCreate } from "../rules";
import { computed, ref } from "vue";
import { RULES_COUNT_MAX } from "../constant";
import { useSettings } from "../composables/settings";
import { useToast } from "../composables/toast";
import type { RuleDraft } from "./components/RuleModal.vue";

const SECTIONS = [
    { key: "general", label: "General" },
    { key: "rules", label: "Rules" },
    { key: "groups", label: "Groups" },
    { key: "presets", label: "Presets" },
    { key: "about", label: "About" },
];

const { notify } = useToast();
const { diagnostic, dismiss, ready, save, settings, skipped } = useSettings();

const modalUrl = ref<string | null>(null);
const section = ref("general");

const modalRule = computed(() => settings.value.rules.find(rule => rule.url === modalUrl.value));

async function enabledToggle(enabled: boolean): Promise<void> {
    settings.value.enabled = enabled;

    await save();
}

async function groupAdd(name: string): Promise<void> {
    settings.value.groups = groupsSort([...settings.value.groups, name]);

    if (!await save()) return;

    notify("Group added");
}

async function groupAssign(group: string, urls: string[]): Promise<void> {
    const chosen = new Set(urls);
    const target = group.toLowerCase();

    for (const rule of settings.value.rules) {
        if (chosen.has(rule.url)) rule.group = group;
        else if (rule.group.toLowerCase() === target) rule.group = "";
    }

    if (!await save()) return;

    notify(`${group} updated`);
}

async function groupRemove(group: string): Promise<void> {
    const target = group.toLowerCase();

    settings.value.groups = settings.value.groups.filter(name => name.toLowerCase() !== target);

    for (const rule of settings.value.rules) {
        if (rule.group.toLowerCase() === target) rule.group = "";
    }

    if (!await save()) return;

    notify("Group deleted");
}

async function groupRename(from: string, to: string): Promise<void> {
    const target = from.toLowerCase();

    settings.value.groups = groupsSort(settings.value.groups.map(name => (name.toLowerCase() === target ? to : name)));

    for (const rule of settings.value.rules) {
        if (rule.group.toLowerCase() === target) rule.group = to;
    }

    if (!await save()) return;

    notify("Group renamed");
}

async function presetToggle(urls: string[], active: boolean): Promise<void> {
    const present = new Set(settings.value.rules.map(rule => canonical(rule.url)));

    if (active) {
        const missing = urls.filter(url => !present.has(canonical(url)));

        if (missing.length === 0) return;

        if (settings.value.rules.length + missing.length > RULES_COUNT_MAX) {
            notify(`CacheControl holds ${RULES_COUNT_MAX} rules at most, so delete some first.`, "error");

            return;
        }

        settings.value.rules.push(...missing.map(ruleCreate));
    } else {
        const targets = new Set(urls.map(canonical));

        settings.value.rules = settings.value.rules.filter(rule => !targets.has(canonical(rule.url)));
    }

    if (!await save()) return;

    notify(active ? "Preset added" : "Preset removed");
}

async function ruleAdd(url: string): Promise<void> {
    settings.value.rules.push(ruleCreate(url));

    if (!await save()) return;

    notify("Rule added");
}

async function ruleAssign(url: string, group: string): Promise<void> {
    const rule = settings.value.rules.find(candidate => candidate.url === url);

    if (!rule) return;

    rule.group = group;

    if (!await save()) return;

    notify(group ? `Moved to ${group}` : "Rule ungrouped");
}

async function ruleRemove(url: string): Promise<void> {
    settings.value.rules = settings.value.rules.filter(rule => rule.url !== url);

    if (!await save()) return;

    notify("Rule deleted");
}

async function ruleSave(draft: RuleDraft): Promise<void> {
    const rule = modalRule.value;

    modalUrl.value = null;

    if (!rule) return;

    rule.group = draft.group;
    rule.name = draft.name;
    rule.protocols = draft.protocols;
    rule.resources = draft.resources;
    rule.wildcard = draft.wildcard;

    if (!await save()) return;

    notify("Rule saved");
}

async function ruleToggle(url: string, enabled: boolean): Promise<void> {
    const rule = settings.value.rules.find(candidate => candidate.url === url);

    if (!rule) return;

    rule.enabled = enabled;

    await save();
}
</script>

<template>
    <div class="mx-auto max-w-4xl px-6 py-8">
        <header class="mb-8 flex items-center gap-2">
            <BaseIcon name="mark" class="text-accent" :size="22" />
            <h1 class="text-base font-semibold">CacheControl</h1>
        </header>

        <div
            v-if="diagnostic"
            role="alert"
            class="mb-6 flex items-start justify-between gap-4 rounded-lg border border-danger bg-surface-1 px-4 py-3"
        >
            <p class="text-xs text-danger">{{ diagnostic.message }}</p>

            <BaseButton size="sm" variant="ghost" @click="dismiss">Dismiss</BaseButton>
        </div>

        <div class="flex flex-col gap-6 md:grid md:grid-cols-[160px_1fr] md:items-start md:gap-10">
            <nav class="flex gap-1 overflow-x-auto md:flex-col" aria-label="Settings sections">
                <button
                    v-for="item in SECTIONS"
                    :key="item.key"
                    type="button"
                    class="cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out"
                    :class="section === item.key ? 'bg-surface-2 text-accent' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'"
                    :aria-current="section === item.key ? 'page' : undefined"
                    @click="section = item.key"
                >
                    {{ item.label }}
                </button>
            </nav>

            <main v-if="ready" class="min-w-0">
                <GeneralSection v-if="section === 'general'" :enabled="settings.enabled" @toggle="enabledToggle" />

                <RulesSection
                    v-else-if="section === 'rules'"
                    :groups="settings.groups"
                    :rules="settings.rules"
                    :skipped="skipped"
                    @add="ruleAdd"
                    @assign="ruleAssign"
                    @configure="modalUrl = $event"
                    @remove="ruleRemove"
                    @toggle="ruleToggle"
                />

                <GroupsSection
                    v-else-if="section === 'groups'"
                    :groups="settings.groups"
                    :rules="settings.rules"
                    @add="groupAdd"
                    @assign="groupAssign"
                    @remove="groupRemove"
                    @rename="groupRename"
                />

                <PresetSection v-else-if="section === 'presets'" :rules="settings.rules" @toggle="presetToggle" />

                <AboutSection v-else />
            </main>
        </div>
    </div>

    <RuleModal
        v-if="modalUrl"
        :groups="settings.groups"
        :rule="modalRule"
        :url="modalUrl"
        @close="modalUrl = null"
        @save="ruleSave"
    />

    <BaseToast />
</template>
