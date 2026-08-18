<script setup lang="ts">
defineSlots<{ default: () => unknown }>();

function rowPin(element: Element): void {
    if (!(element instanceof HTMLElement)) return;

    const row = element;

    row.style.left = `${row.offsetLeft}px`;
    row.style.top = `${row.offsetTop}px`;
    row.style.width = `${row.offsetWidth}px`;
}

function rowUnpin(element: Element): void {
    if (!(element instanceof HTMLElement)) return;

    const row = element;

    row.style.left = "";
    row.style.top = "";
    row.style.width = "";
}
</script>

<template>
    <TransitionGroup
        tag="ul"
        class="relative"
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="-translate-y-1 opacity-0"
        leave-active-class="absolute transition-opacity duration-150 ease-out"
        leave-to-class="opacity-0"
        move-class="transition-transform duration-150 ease-out"
        @before-enter="rowUnpin"
        @before-leave="rowPin"
        @leave-cancelled="rowUnpin"
    >
        <slot />
    </TransitionGroup>
</template>
