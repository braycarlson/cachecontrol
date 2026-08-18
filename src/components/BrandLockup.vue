<script setup lang="ts">
import BaseIcon from "./BaseIcon.vue";

const { size = 32 } = defineProps<{ size?: number }>();

const LOCKUP_FONT_RATIO = 46 / 72;

const LOCKUP_GAP_RATIO = 20 / 72;

const LOCKUP_MARK_RATIO = 44 / 72;

const LOCKUP_RADIUS_RATIO = 14 / 72;

const LOCKUP_TRACKING = "-0.025em";
</script>

<template>
    <span class="inline-flex items-center" :style="{ gap: `${size * LOCKUP_GAP_RATIO}px` }">
        <span
            class="inline-flex shrink-0 items-center justify-center bg-brand-tile text-brand-ink"
            :style="{
                borderRadius: `${size * LOCKUP_RADIUS_RATIO}px`,
                height: `${size}px`,
                width: `${size}px`,
            }"
        >
            <BaseIcon name="mark" :size="size * LOCKUP_MARK_RATIO" />
        </span>

        <span
            class="font-brand leading-none text-brand-tile"
            :style="{ fontSize: `${size * LOCKUP_FONT_RATIO}px`, letterSpacing: LOCKUP_TRACKING }"
        ><span class="font-normal">cache</span><span class="font-bold">control</span></span>
    </span>
</template>
