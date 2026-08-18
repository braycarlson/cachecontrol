import { assert } from "./assert";
import type { WebRequest } from "webextension-polyfill";

export const HEADERS_CACHE_DISABLED = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Expires: "0",
    Pragma: "no-cache",
    "Surrogate-Control": "no-store",
} as const satisfies Record<string, string>;

export const PROTOCOLS_DEFAULT = [
    "http",
    "https",
] as const;

export const RESOURCES_DEFAULT = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "other",
] as const satisfies readonly WebRequest.ResourceType[];

export type Protocol = (typeof PROTOCOLS_DEFAULT)[number];

export type ResourceType = (typeof RESOURCES_DEFAULT)[number];

export const PROTOCOL_LABELS = {
    http: "HTTP",
    https: "HTTPS",
} as const satisfies Record<Protocol, string>;

export const RESOURCE_LABELS = {
    csp_report: "CSP Report",
    font: "Font",
    image: "Image",
    main_frame: "Main Frame",
    media: "Media",
    object: "Object",
    other: "Other",
    ping: "Ping",
    script: "Script",
    stylesheet: "Stylesheet",
    sub_frame: "Sub Frame",
    websocket: "WebSocket",
    xmlhttprequest: "XMLHttpRequest",
} as const satisfies Record<ResourceType, string>;

export const DNR_RULES_COUNT_MAX = 5000;

export const RULES_COUNT_MAX = 512;

export const GROUPS_COUNT_MAX = 64;

export const PORT_MIN = 0;

export const PORT_MAX = 65535;

export const REGEX_CHECKS_CONCURRENT_MAX = 8;

export const SYNC_DEBOUNCE_MS = 50;

export const RULE_GROUP_NAME_LENGTH_MAX = 24;

export const RULE_NAME_LENGTH_MAX = 60;

export const REPOSITORY_URL = "https://github.com/braycarlson/cachecontrol";

assert(
    RULES_COUNT_MAX * PROTOCOLS_DEFAULT.length <= DNR_RULES_COUNT_MAX,
    "the worst-case compiled output fits the browser's dynamic rule ceiling",
);

export const HOSTS_PRESET = [
    "localhost",
    "127.0.0.1",
] as const;

export interface PresetGroup {
    label: string;
    ports: readonly number[];
}

export const GROUPS_PRESET = [
    {
        label: "Angular",
        ports: [
            4200,
            4201,
        ],
    },
    {
        label: "Astro",
        ports: [
            4321,
            4322,
        ],
    },
    {
        label: "Django",
        ports: [
            8000,
            8001,
        ],
    },
    {
        label: "Flask",
        ports: [
            5000,
            5001,
        ],
    },
    {
        label: "Hugo",
        ports: [
            1313,
            1314,
        ],
    },
    {
        label: "JupyterLab",
        ports: [
            8888,
            8889,
        ],
    },
    {
        label: "Live Server",
        ports: [
            5500,
            5501,
        ],
    },
    {
        label: "Node.js",
        ports: [
            3002,
            3003,
        ],
    },
    {
        label: "Parcel",
        ports: [
            1234,
            1235,
        ],
    },
    {
        label: "Phoenix",
        ports: [
            4000,
            4001,
        ],
    },
    {
        label: "React",
        ports: [
            3000,
            3001,
        ],
    },
    {
        label: "Storybook",
        ports: [
            6006,
            6007,
        ],
    },
    {
        label: "Streamlit",
        ports: [
            8501,
            8502,
        ],
    },
    {
        label: "Vite",
        ports: [
            5173,
            5174,
        ],
    },
    {
        label: "Webpack",
        ports: [
            8080,
            8081,
        ],
    },
] as const satisfies readonly PresetGroup[];
