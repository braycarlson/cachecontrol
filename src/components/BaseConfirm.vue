<script setup lang="ts">
import BaseButton from "./BaseButton.vue";
import BaseModal from "./BaseModal.vue";

const { confirmLabel = "Delete" } = defineProps<{ confirmLabel?: string; title: string }>();

const emit = defineEmits<{
    cancel: [];
    confirm: [];
}>();

defineSlots<{ default: () => unknown }>();
</script>

<template>
    <BaseModal :title="title" @close="emit('cancel')">
        <p class="text-sm text-text-secondary">
            <slot />
        </p>

        <template #footer>
            <BaseButton variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
            <BaseButton variant="danger" @click="emit('confirm')">{{ confirmLabel }}</BaseButton>
        </template>
    </BaseModal>
</template>
