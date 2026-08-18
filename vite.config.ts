import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import webExtension from "vite-plugin-web-extension";
import { defineConfig } from "vite";
import { version } from "./package.json" with { type: "json" };

const TARGET = process.env["TARGET"] ?? "firefox";

export default defineConfig({
    build: {
        outDir: `dist/${TARGET}`,
    },
    plugins: [
        vue(),
        tailwindcss(),
        webExtension({
            browser: TARGET,
            transformManifest: manifest => ({ ...manifest, version }),
        }),
    ],
});
