<script setup lang="ts">
import { ICONS } from "./icons";
import type { IconName } from "./icons";

const { size = 16 } = defineProps<{ name: IconName; size?: number }>();
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
        :width="size"
        :height="size"
    >
        <path v-for="path in ICONS[name]" :key="path" :d="path" />
    </svg>
</template>
