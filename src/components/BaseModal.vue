<script setup lang="ts">
import BaseIcon from "./BaseIcon.vue";
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";

defineProps<{ title: string }>();

const emit = defineEmits<{ close: [] }>();

defineSlots<{
    default: () => unknown;
    footer: () => unknown;
    header: () => unknown;
}>();

const SELECTOR_FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";

const panel = useTemplateRef<HTMLElement>("panel");

let elementRestore: HTMLElement | null = null;

function elementsFocusable(): HTMLElement[] {
    if (!panel.value) return [];

    return Array.from(panel.value.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE));
}

function focusTrap(event: KeyboardEvent): void {
    if (event.key === "Escape") {
        event.preventDefault();
        emit("close");

        return;
    }

    if (event.key !== "Tab") return;

    const targets = elementsFocusable();
    const first = targets.at(0);
    const last = targets.at(-1);

    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

onMounted(() => {
    const active = document.activeElement;

    elementRestore = active instanceof HTMLElement ? active : null;

    elementsFocusable()[0]?.focus();

    document.addEventListener("keydown", focusTrap);
});

onBeforeUnmount(() => {
    document.removeEventListener("keydown", focusTrap);
    elementRestore?.focus();
});
</script>

<template>
    <Teleport to="body">
        <Transition
            appear
            enter-active-class="transition-opacity duration-150 ease-out"
            enter-from-class="opacity-0"
        >
            <div class="fixed inset-0 z-40 flex items-center justify-center bg-canvas/80 p-4" @click.self="emit('close')">
                <div
                    ref="panel"
                    role="dialog"
                    aria-modal="true"
                    class="flex max-h-[calc(100vh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-modal"
                    :aria-label="title"
                >
                    <header class="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
                        <div class="min-w-0">
                            <slot name="header">
                                <p class="truncate text-sm font-semibold text-text-primary">{{ title }}</p>
                            </slot>
                        </div>

                        <button
                            type="button"
                            class="-mt-1 -mr-1 cursor-pointer rounded-lg p-1 text-text-secondary transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text-primary"
                            aria-label="Close"
                            @click="emit('close')"
                        >
                            <BaseIcon name="xmark" :size="18" />
                        </button>
                    </header>

                    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        <slot />
                    </div>

                    <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
                        <slot name="footer" />
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
