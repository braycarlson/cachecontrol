<script setup lang="ts">
import BaseIcon from "./BaseIcon.vue";
import { useAttrs } from "vue";

export interface SelectOption {
    label: string;
    value: string;
}

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ required: true });

defineProps<{
    hideLabel?: boolean;
    id: string;
    label: string;
    options: readonly SelectOption[];
}>();

const attrs = useAttrs();
</script>

<template>
    <div class="flex flex-col gap-1.5" :class="attrs['class']">
        <label :for="id" :class="hideLabel ? 'sr-only' : 'text-xs font-medium text-text-secondary'">{{ label }}</label>

        <div class="relative flex items-center">
            <select
                :id="id"
                v-model="model"
                class="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface-2 pr-9 pl-3 text-sm text-text-primary transition-colors duration-150 ease-out hover:border-accent"
            >
                <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>

            <BaseIcon name="chevron" class="pointer-events-none absolute right-3 text-text-secondary" :size="16" />
        </div>
    </div>
</template>
