<script setup lang="ts">
const { size = "md", type = "button", variant = "secondary" } = defineProps<{
    size?: keyof typeof SIZES;
    type?: "button" | "submit";
    variant?: keyof typeof VARIANTS;
}>();

defineSlots<{ default: () => unknown }>();

const SIZES = {
    md: "h-9 gap-2 px-3 text-sm",
    sm: "h-7 gap-1.5 px-2.5 text-xs",
};

const VARIANTS = {
    danger: "border border-danger bg-danger text-canvas hover:opacity-90",
    ghost: "border border-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary",
    primary: "border border-accent bg-accent text-canvas hover:border-accent-strong hover:bg-accent-strong",
    secondary: "border border-border bg-surface-2 text-text-primary hover:border-accent hover:text-accent",
};
</script>

<template>
    <button
        class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors duration-150 ease-out select-none disabled:pointer-events-none disabled:opacity-40"
        :class="[SIZES[size], VARIANTS[variant]]"
        :type="type"
    >
        <slot />
    </button>
</template>
