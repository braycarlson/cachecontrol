<script setup lang="ts">
import BaseButton from "../components/BaseButton.vue";
import BaseField from "../components/BaseField.vue";
import BaseIcon from "../components/BaseIcon.vue";
import BaseSwitch from "../components/BaseSwitch.vue";
import BaseToast from "../components/BaseToast.vue";
import browser from "webextension-polyfill";
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { ruleCreate, ruleError, ruleFind } from "../rules";
import { errorDescribe } from "../diagnostic";
import { useTabCurrent } from "../composables/tab";
import { useSettings } from "../composables/settings";
import { useToast } from "../composables/toast";

const { host, origin, resolved } = useTabCurrent();
const { notify } = useToast();
const { ready, save, settings } = useSettings();

const addFormOpen = ref(false);
const error = ref("");
const field = useTemplateRef<InstanceType<typeof BaseField>>("field");
const url = ref("");

const loaded = computed(() => ready.value && resolved.value);
const ruleCurrent = computed(() => ruleFind(settings.value.rules, host.value));

function addCancel(): void {
    addFormOpen.value = false;
    error.value = "";
    url.value = "";
}

async function addStart(): Promise<void> {
    addFormOpen.value = true;

    await nextTick();

    field.value?.focus();
}

async function enabledToggle(enabled: boolean): Promise<void> {
    settings.value.enabled = enabled;

    await save();
}

async function optionsOpen(): Promise<void> {
    try {
        await browser.runtime.openOptionsPage();
    } catch (cause) {
        notify(`The options page did not open. ${errorDescribe(cause)}`, "error");

        return;
    }

    window.close();
}

async function ruleAdd(): Promise<void> {
    error.value = ruleError(url.value, settings.value.rules);

    if (error.value) return;

    settings.value.rules.push(ruleCreate(url.value.trim()));

    addFormOpen.value = false;
    url.value = "";

    if (!await save()) return;

    notify("Rule added");
}

async function ruleToggle(target: string, enabled: boolean): Promise<void> {
    const rule = settings.value.rules.find(candidate => candidate.url === target);

    if (!rule) return;

    rule.enabled = enabled;

    await save();
}

async function siteCurrentAdd(): Promise<void> {
    const failure = ruleError(origin.value, settings.value.rules);

    if (failure) {
        notify(failure, "error");

        return;
    }

    settings.value.rules.push(ruleCreate(origin.value));

    if (!await save()) return;

    notify(`Cache disabled for ${host.value}`);
}
</script>

<template>
    <div class="flex w-[340px] min-h-[180px] flex-col">
        <template v-if="loaded">
            <header class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div class="flex items-center gap-2">
                    <BaseIcon name="mark" class="text-accent" :size="20" />
                    <span class="text-sm font-semibold">CacheControl</span>
                </div>

                <BaseSwitch
                    :model-value="settings.enabled"
                    label="Enable CacheControl"
                    @update:model-value="enabledToggle"
                />
            </header>

            <div
                class="flex flex-col transition-opacity duration-150 ease-out"
                :class="settings.enabled ? '' : 'opacity-40'"
            >
                <section class="border-b border-border px-4 py-3">
                    <p class="mb-2 text-xs font-medium tracking-wide text-text-secondary uppercase">Current site</p>

                    <template v-if="host">
                        <div class="flex items-center justify-between gap-3">
                            <span class="truncate font-mono text-sm">{{ host }}</span>

                            <BaseSwitch
                                v-if="ruleCurrent"
                                :model-value="ruleCurrent.enabled"
                                :label="`Disable cache for ${host}`"
                                @update:model-value="ruleToggle(ruleCurrent.url, $event)"
                            />
                        </div>

                        <p v-if="ruleCurrent" class="mt-1 text-xs text-text-secondary">
                            {{ ruleCurrent.enabled ? "Cache is disabled here." : "This rule is turned off." }}
                        </p>

                        <BaseButton v-else variant="primary" class="mt-3 w-full" @click="siteCurrentAdd">
                            Disable cache for this site
                        </BaseButton>
                    </template>

                    <p v-else class="text-xs text-text-secondary">This page has no address a rule can match.</p>
                </section>

                <section v-if="!ruleCurrent" class="border-b border-border px-4 py-3">
                    <p class="text-xs text-text-secondary">
                        CacheControl forces a fresh fetch for every URL you list, so start with the site you are on.
                    </p>
                </section>

                <footer class="flex flex-col gap-1 px-4 py-3">
                    <div v-if="addFormOpen" class="flex flex-col gap-2 pb-1">
                        <BaseField
                            id="popup-url"
                            ref="field"
                            v-model="url"
                            hide-label
                            mono
                            label="URL"
                            placeholder="localhost:3000"
                            :error="error"
                            @keydown.enter="ruleAdd"
                            @keydown.esc="addCancel"
                        />

                        <div class="flex gap-2">
                            <BaseButton variant="primary" class="flex-1" @click="ruleAdd">Add rule</BaseButton>
                            <BaseButton variant="ghost" @click="addCancel">Cancel</BaseButton>
                        </div>
                    </div>

                    <BaseButton v-else size="sm" variant="ghost" class="w-full justify-start" @click="addStart">
                        <BaseIcon name="plus" :size="14" />
                        Add custom URL
                    </BaseButton>

                    <BaseButton size="sm" variant="ghost" class="w-full justify-start" @click="optionsOpen">
                        <BaseIcon name="external" :size="14" />
                        Manage rules
                    </BaseButton>
                </footer>
            </div>
        </template>

        <BaseToast />
    </div>
</template>
