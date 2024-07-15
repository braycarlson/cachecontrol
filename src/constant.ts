export const CACHE_DISABLED_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store"
};

export const PRESETS: { [key: string]: string } = {
    react3000: "http://localhost:3000",
    react3001: "http://localhost:3001",
    jupyter8888: "http://localhost:8888",
    jupyter8889: "http://localhost:8889",
    node3002: "http://localhost:3002",
    node3003: "http://localhost:3003",
    docker5000: "http://localhost:5000",
    docker5001: "http://localhost:5001",
    angular4200: "http://localhost:4200",
    angular4201: "http://localhost:4201"
};

export const DEFAULTRESOURCES = [
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
    "other"
];

export const DEFAULTPROTOCOLS = [
    "http",
    "https"
];
