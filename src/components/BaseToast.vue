<script setup lang="ts">
import BaseIcon from "./BaseIcon.vue";
import { useToast } from "../composables/toast";

const { toasts } = useToast();
</script>

<template>
    <Teleport to="body">
        <TransitionGroup
            tag="div"
            class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="translate-y-2 opacity-0"
            leave-active-class="transition duration-150 ease-out absolute"
            leave-to-class="translate-y-2 opacity-0"
            move-class="transition duration-150 ease-out"
        >
            <div
                v-for="toast in toasts"
                :key="toast.id"
                class="flex items-center gap-2 rounded-lg border bg-surface-2 px-3 py-2 text-xs text-text-primary shadow-modal"
                :class="toast.variant === 'error' ? 'border-danger' : 'border-border'"
                :role="toast.variant === 'error' ? 'alert' : 'status'"
            >
                <BaseIcon
                    class="shrink-0"
                    :class="toast.variant === 'error' ? 'text-danger' : 'text-accent'"
                    :name="toast.variant === 'error' ? 'alert' : 'check'"
                    :size="14"
                />
                {{ toast.message }}
            </div>
        </TransitionGroup>
    </Teleport>
</template>
