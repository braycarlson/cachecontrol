<script setup lang="ts">
import BaseButton from "../../components/BaseButton.vue";
import BaseChip from "../../components/BaseChip.vue";
import BaseConfirm from "../../components/BaseConfirm.vue";
import BaseField from "../../components/BaseField.vue";
import BaseIcon from "../../components/BaseIcon.vue";
import BaseList from "../../components/BaseList.vue";
import GroupModal from "./GroupModal.vue";
import GroupRulesModal from "./GroupRulesModal.vue";
import { computed, ref, watch } from "vue";
import { groupCount, groupError } from "../../rules";
import { RULE_GROUP_NAME_LENGTH_MAX } from "../../constant";
import type { Rule } from "../../storage";

const { groups, rules } = defineProps<{ groups: string[]; rules: Rule[] }>();

const emit = defineEmits<{
    add: [name: string];
    assign: [group: string, urls: string[]];
    remove: [group: string];
    rename: [from: string, to: string];
}>();

const error = ref("");
const groupRemoveTarget = ref("");
const groupRenameTarget = ref("");
const groupRulesTarget = ref("");
const name = ref("");

const rulesHeldCount = computed(() => groupCount(rules, groupRemoveTarget.value));

const notice = computed(() => {
    if (rulesHeldCount.value === 0) return `Deleting ${groupRemoveTarget.value} leaves every rule alone, since no rule belongs to it.`;

    const subject = rulesHeldCount.value === 1 ? "One rule belongs" : `${rulesHeldCount.value} rules belong`;

    return `${subject} to ${groupRemoveTarget.value}. Deleting the group keeps them and moves them to Ungrouped.`;
});

function chosenSave(urls: string[]): void {
    const group = groupRulesTarget.value;

    groupRulesTarget.value = "";

    emit("assign", group, urls);
}

function groupAdd(): void {
    error.value = groupError(name.value, groups);

    if (error.value) return;

    emit("add", name.value.trim());

    name.value = "";
}

function nameClear(): void {
    error.value = "";
    name.value = "";
}

function removeConfirm(): void {
    const group = groupRemoveTarget.value;

    groupRemoveTarget.value = "";

    emit("remove", group);
}

function renameSave(next: string): void {
    const from = groupRenameTarget.value;

    groupRenameTarget.value = "";

    emit("rename", from, next);
}

watch(() => groups.length, () => {
    groupRulesTarget.value = "";
    groupRemoveTarget.value = "";
    groupRenameTarget.value = "";
});

watch(name, () => {
    error.value = "";
});
</script>

<template>
    <section>
        <div class="mb-6 rounded-lg border border-border bg-surface-1 px-4 py-3">
            <p class="text-sm font-medium">Add a group</p>

            <p class="mt-1 text-xs text-text-secondary">
                A group is a heading the rules list draws. Every rule picks one group, or none, from the rule editor.
            </p>

            <div class="mt-2 flex items-start gap-3">
                <BaseField
                    id="groups-name"
                    v-model="name"
                    hide-label
                    label="Name"
                    placeholder="Frontend"
                    class="flex-1"
                    :error="error"
                    :maxlength="RULE_GROUP_NAME_LENGTH_MAX"
                    @keydown.enter="groupAdd"
                    @keydown.esc="nameClear"
                />

                <BaseButton variant="primary" @click="groupAdd">
                    <BaseIcon name="plus" :size="16" />
                    Add group
                </BaseButton>
            </div>
        </div>

        <BaseList class="flex flex-col gap-2">
            <li
                v-for="group in groups"
                :key="group"
                class="flex items-center gap-4 rounded-lg border border-border bg-surface-1 px-4 py-3"
            >
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    <p class="truncate text-sm font-medium">{{ group }}</p>

                    <BaseChip>{{ groupCount(rules, group) }}</BaseChip>
                </div>

                <div class="flex shrink-0 items-center gap-1">
                    <BaseButton
                        size="sm"
                        variant="ghost"
                        :aria-label="`Choose the rules in ${group}`"
                        @click="groupRulesTarget = group"
                    >
                        <BaseIcon name="list" :size="16" />
                    </BaseButton>

                    <BaseButton
                        size="sm"
                        variant="ghost"
                        :aria-label="`Rename the group ${group}`"
                        @click="groupRenameTarget = group"
                    >
                        <BaseIcon name="pencil" :size="16" />
                    </BaseButton>

                    <BaseButton
                        size="sm"
                        variant="ghost"
                        :aria-label="`Delete the group ${group}`"
                        @click="groupRemoveTarget = group"
                    >
                        <BaseIcon name="trash" :size="16" />
                    </BaseButton>
                </div>
            </li>
        </BaseList>

        <Transition
            mode="out-in"
            enter-active-class="transition-opacity delay-150 duration-150 ease-out"
            enter-from-class="opacity-0"
        >
            <p v-if="groups.length === 0" class="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
                No groups yet. Add one above, then pick it from the rule editor.
            </p>
        </Transition>

        <GroupModal
            v-if="groupRenameTarget"
            :group="groupRenameTarget"
            :groups="groups"
            @close="groupRenameTarget = ''"
            @save="renameSave"
        />

        <GroupRulesModal
            v-if="groupRulesTarget"
            :group="groupRulesTarget"
            :rules="rules"
            @close="groupRulesTarget = ''"
            @save="chosenSave"
        />

        <BaseConfirm
            v-if="groupRemoveTarget"
            confirm-label="Delete group"
            :title="`Delete ${groupRemoveTarget}?`"
            @cancel="groupRemoveTarget = ''"
            @confirm="removeConfirm"
        >
            {{ notice }}
        </BaseConfirm>
    </section>
</template>
