<script setup lang="ts">
import BaseButton from "../../components/BaseButton.vue";
import BaseField from "../../components/BaseField.vue";
import BaseModal from "../../components/BaseModal.vue";
import { computed, ref, watch } from "vue";
import { groupError } from "../../rules";
import { RULE_GROUP_NAME_LENGTH_MAX } from "../../constant";

const { group, groups = [] } = defineProps<{ group: string; groups?: string[] }>();

const emit = defineEmits<{
    close: [];
    save: [name: string];
}>();

const error = ref("");
const name = ref("");

const changed = computed(() => name.value.trim() !== group);

function groupSave(): void {
    error.value = groupError(name.value, groups, group);

    if (error.value) return;

    emit("save", name.value.trim());
}

watch(
    () => group,
    () => {
        error.value = "";
        name.value = group;
    },
    { immediate: true },
);

watch(name, () => {
    error.value = "";
});
</script>

<template>
    <BaseModal title="Rename group" @close="emit('close')">
        <template #header>
            <p class="text-xs font-medium tracking-wide text-text-secondary uppercase">Group</p>
            <p class="truncate text-sm">{{ group }}</p>
        </template>

        <BaseField
            id="group-name"
            v-model="name"
            label="Name"
            placeholder="A name for this group"
            :error="error"
            :maxlength="RULE_GROUP_NAME_LENGTH_MAX"
            @keydown.enter="groupSave"
        />

        <p class="mt-2 text-xs text-text-secondary">
            Every rule in this group follows the new name.
        </p>

        <template #footer>
            <BaseButton variant="ghost" @click="emit('close')">Cancel</BaseButton>
            <BaseButton variant="primary" :disabled="!changed" @click="groupSave">Save</BaseButton>
        </template>
    </BaseModal>
</template>
