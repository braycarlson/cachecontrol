<script setup lang="ts">
import BaseIcon from "./BaseIcon.vue";
import { useTemplateRef, watchEffect } from "vue";

const model = defineModel<boolean>({ required: true });

const { indeterminate } = defineProps<{ disabled?: boolean; indeterminate?: boolean; label: string }>();

const input = useTemplateRef<HTMLInputElement>("input");

watchEffect(() => {
    if (input.value) input.value.indeterminate = indeterminate;
});
</script>

<template>
    <label
        class="flex items-center gap-2 select-none"
        :class="disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'"
    >
        <input ref="input" v-model="model" type="checkbox" class="peer sr-only" :disabled="disabled">

        <span
            class="flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ease-out peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            :class="model || indeterminate ? 'border-accent bg-accent text-canvas' : 'border-border bg-surface-2'"
        >
            <BaseIcon v-if="indeterminate" name="minus" :size="12" />
            <BaseIcon v-else-if="model" name="check" :size="12" />
        </span>

        <span class="truncate text-sm text-text-primary">{{ label }}</span>
    </label>
</template>
