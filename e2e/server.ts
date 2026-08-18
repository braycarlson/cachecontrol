import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

export interface Harness {
    close: () => Promise<void>;
    count: (path: string) => number;
    injected: (path: string) => boolean;
    log: LoggedRequest[];
    origin: string;
    port: number;
    reset: () => void;
}

export interface LoggedRequest {
    cacheControl: string;
    ifModifiedSince: string;
    ifNoneMatch: string;
    method: string;
    path: string;
    pragma: string;
}

const ASSET_MAX_AGE = "max-age=3600";

const BEACON_DELAY_MS = 250;

const MEDIA_TIMEOUT_MS = 1500;

const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
);

const REDIRECT_DELAY_MS = 150;

const ROUTES: Record<string, (target: URL, response: ServerResponse) => void> = {
    "/asset.css": (_target, response) => {
        assetWrite(response, "text/css", "body { color: #111; }", "\"asset-css\"");
    },
    "/asset.js": (_target, response) => {
        assetWrite(response, "application/javascript", "globalThis.__cachecontrol = true;", "\"asset-js\"");
    },
    "/asset.json": (_target, response) => {
        plainWrite(response, "application/json", "{}");
    },
    "/asset.mp4": (_target, response) => {
        plainWrite(response, "video/mp4", "not-a-video");
    },
    "/asset.png": (_target, response) => {
        assetWrite(response, "image/png", PIXEL, "\"asset-png\"");
    },
    "/asset.woff2": (_target, response) => {
        plainWrite(response, "font/woff2", "not-a-font");
    },
    "/beacon": (_target, response) => {
        emptyWrite(response);
    },
    "/csp": (_target, response) => {
        emptyWrite(response);
    },
    "/done": (_target, response) => {
        htmlWrite(response, "<!doctype html><html><head><title>Done</title></head><body><p>Done</p></body></html>");
    },
    "/frame.html": (_target, response) => {
        htmlWrite(response, "<!doctype html><html><head><title>Frame</title></head><body><p>Frame</p></body></html>");
    },
    "/resources": (_target, response) => {
        resourcesWrite(response);
    },
    "/settled": (_target, response) => {
        emptyWrite(response);
    },
    "/start": (target, response) => {
        htmlWrite(response, warmup(Number(target.searchParams.get("loads") ?? "5")));
    },
};

const WARMUP_MS = 3000;

function assets(): string {
    return [
        "<link rel=\"stylesheet\" href=\"/asset.css\">",
        "<script src=\"/asset.js\"></script>",
        "<img src=\"/asset.png\" alt=\"\">",
    ].join("");
}

function assetWrite(response: ServerResponse, type: string, body: Buffer | string, etag: string): void {
    response.writeHead(200, {
        "Cache-Control": ASSET_MAX_AGE,
        "Content-Type": type,
        ETag: etag,
    });
    response.end(body);
}

function emptyWrite(response: ServerResponse): void {
    response.writeHead(204);
    response.end();
}

export async function harnessStart(requested = 0): Promise<Harness> {
    const log: LoggedRequest[] = [];

    function handle(request: IncomingMessage, response: ServerResponse): void {
        const target = new URL(request.url ?? "/", "http://127.0.0.1");

        log.push({
            cacheControl: header(request, "cache-control"),
            ifModifiedSince: header(request, "if-modified-since"),
            ifNoneMatch: header(request, "if-none-match"),
            method: request.method ?? "GET",
            path: target.pathname,
            pragma: header(request, "pragma"),
        });

        respond(target, response);
    }

    const server: Server = createServer(handle);

    await new Promise<void>(resolve => {
        server.listen(requested, "127.0.0.1", resolve);
    });

    const address = server.address();

    if (address === null || typeof address === "string") throw new Error("The harness did not bind a port.");

    const { port } = address;

    return {
        close: async (): Promise<void> => {
            await new Promise<void>((resolve, reject) => {
                server.close(error => {
                    if (error) {
                        reject(error);

                        return;
                    }

                    resolve();
                });
            });
        },
        count: (path): number => log.filter(entry => entry.path === path).length,
        injected: path => log.some(entry => entry.path === path && entry.cacheControl.includes("no-store")),
        log,
        origin: `http://127.0.0.1:${port}`,
        port,
        reset: (): void => {
            log.length = 0;
        },
    };
}

function header(request: IncomingMessage, name: string): string {
    const value = request.headers[name];

    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join(", ");

    return "";
}

function htmlWrite(response: ServerResponse, body: string): void {
    response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
    });
    response.end(body);
}

function page(load: number, loads: number): string {
    const next = load < loads ? `/page?load=${load + 1}&loads=${loads}` : "/done";

    return [
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>CacheControl harness</title>",
        assets(),
        "</head><body><p id=\"load\">",
        String(load),
        "</p><script>",
        `addEventListener("load", () => { setTimeout(() => { location.href = ${JSON.stringify(next)}; }, ${REDIRECT_DELAY_MS}); });`,
        "</script></body></html>",
    ].join("");
}

function plainWrite(response: ServerResponse, type: string, body: string): void {
    response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": type,
    });
    response.end(body);
}

function resourcesPage(): string {
    return [
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>CacheControl resources</title>",
        assets(),
        "<style>@font-face { font-family: HarnessFont; src: url(\"/asset.woff2\"); }</style>",
        "</head><body><p style=\"font-family: HarnessFont\">Resources</p>",
        "<iframe src=\"/frame.html\"></iframe>",
        "<video muted preload=\"auto\" src=\"/asset.mp4\"></video>",
        "<script>",
        "function videoSettled() {",
        "    return new Promise(resolve => {",
        "        const video = document.querySelector(\"video\");",
        "        for (const name of [\"error\", \"loadedmetadata\", \"suspend\"]) video.addEventListener(name, resolve, { once: true });",
        `        setTimeout(resolve, ${MEDIA_TIMEOUT_MS});`,
        "    });",
        "}",
        "addEventListener(\"load\", () => {",
        "    Promise.allSettled([",
        "        document.fonts.load(\"1em HarnessFont\"),",
        "        fetch(\"/asset.json\"),",
        "        videoSettled(),",
        "    ]).then(() => {",
        "        navigator.sendBeacon(\"/beacon\", \"settled\");",
        `        setTimeout(() => { fetch("/settled"); }, ${BEACON_DELAY_MS});`,
        "    });",
        "});",
        "</script></body></html>",
    ].join("");
}

function resourcesWrite(response: ServerResponse): void {
    response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Security-Policy-Report-Only": "img-src 'none'; report-uri /csp",
        "Content-Type": "text/html; charset=utf-8",
    });
    response.end(resourcesPage());
}

function respond(target: URL, response: ServerResponse): void {
    const route = ROUTES[target.pathname];

    if (route) {
        route(target, response);

        return;
    }

    htmlWrite(response, page(
        Number(target.searchParams.get("load") ?? "1"),
        Number(target.searchParams.get("loads") ?? "1"),
    ));
}

function warmup(loads: number): string {
    return [
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>CacheControl warmup</title></head>",
        "<body><p>Waiting for the extension to install.</p><script>",
        `setTimeout(() => { location.href = "/page?load=1&loads=${loads}"; }, ${WARMUP_MS});`,
        "</script></body></html>",
    ].join("");
}
