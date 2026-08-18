<script setup lang="ts">
const model = defineModel<boolean>({ required: true });

defineProps<{ disabled?: boolean; label: string }>();
</script>

<template>
    <button
        type="button"
        role="switch"
        class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-40"
        :class="model ? 'border-accent bg-accent' : 'border-border bg-surface-2'"
        :aria-checked="model"
        :aria-label="label"
        :disabled="disabled"
        @click="model = !model"
    >
        <span
            class="absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 rounded-full transition-transform duration-150 ease-out"
            :class="model ? 'translate-x-4 bg-canvas' : 'translate-x-0 bg-text-secondary'"
        />
    </button>
</template>
