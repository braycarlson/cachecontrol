<script setup lang="ts">
import BaseIcon from "./BaseIcon.vue";
import { computed, useAttrs, useTemplateRef } from "vue";
import type { IconName } from "./icons";

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ required: true });

const { error = "", placeholder = "" } = defineProps<{
    error?: string;
    hideLabel?: boolean;
    icon?: IconName;
    id: string;
    label: string;
    mono?: boolean;
    placeholder?: string;
}>();

const attrs = useAttrs();
const field = useTemplateRef<HTMLInputElement>("field");

const inputAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;

    return rest;
});

function focus(): void {
    field.value?.focus();
}

defineExpose({ focus });
</script>

<template>
    <div class="flex flex-col gap-1.5" :class="attrs['class']">
        <label :for="id" :class="hideLabel ? 'sr-only' : 'text-xs font-medium text-text-secondary'">{{ label }}</label>

        <div class="relative flex items-center">
            <BaseIcon v-if="icon" :name="icon" class="pointer-events-none absolute left-3 text-text-secondary" :size="16" />

            <input
                :id="id"
                ref="field"
                v-model="model"
                type="text"
                class="h-9 w-full rounded-lg border bg-surface-2 px-3 text-sm text-text-primary transition-colors duration-150 ease-out placeholder:text-text-secondary"
                :class="[
                    error ? 'border-danger' : 'border-border hover:border-accent',
                    icon ? 'pl-9' : '',
                    mono ? 'font-mono' : '',
                ]"
                :aria-describedby="error ? `${id}-error` : undefined"
                :aria-invalid="error ? 'true' : undefined"
                :placeholder="placeholder"
                v-bind="inputAttrs"
            >
        </div>

        <p v-if="error" :id="`${id}-error`" class="text-xs text-danger">{{ error }}</p>
    </div>
</template>
