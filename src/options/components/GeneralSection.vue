<script setup lang="ts">
import BaseSwitch from "../../components/BaseSwitch.vue";

defineProps<{ enabled: boolean }>();

const emit = defineEmits<{ toggle: [enabled: boolean] }>();
</script>

<template>
    <section>
        <div class="flex items-start justify-between gap-6 rounded-lg border border-border bg-surface-1 px-4 py-3">
            <div>
                <p class="text-sm font-medium">Enable CacheControl</p>

                <p class="mt-1 text-xs text-text-secondary">
                    Turning this off keeps every rule but stops the extension from touching any request, so pages cache the way the browser decides.
                </p>
            </div>

            <BaseSwitch
                class="mt-0.5"
                label="Enable CacheControl"
                :model-value="enabled"
                @update:model-value="emit('toggle', $event)"
            />
        </div>
    </section>
</template>
