<script setup lang="ts">
const { active, interactive } = defineProps<{ active?: boolean; interactive?: boolean }>();

const emit = defineEmits<{ toggle: [] }>();

defineSlots<{ default: () => unknown }>();
</script>

<template>
    <component
        :is="interactive ? 'button' : 'span'"
        class="inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-out"
        :class="[
            active ? 'border-accent bg-accent text-canvas' : 'border-border bg-surface-2 text-text-secondary',
            interactive ? 'cursor-pointer select-none' : '',
            interactive && !active ? 'hover:border-accent hover:text-text-primary' : '',
            interactive && active ? 'hover:border-accent-strong hover:bg-accent-strong' : '',
        ]"
        :aria-pressed="interactive ? active : undefined"
        :type="interactive ? 'button' : undefined"
        @click="interactive && emit('toggle')"
    >
        <slot />
    </component>
</template>
