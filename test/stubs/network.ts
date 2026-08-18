export interface BlockingResult {
    requestHeaders?: HttpHeader[];
    responseHeaders?: HttpHeader[];
}

export interface DeclarativeNetRequestStub {
    concurrent: number;
    concurrentMax: number;
    getDynamicRules: () => Promise<DnrRule[]>;
    isRegexSupported: (options: RegexOptions) => Promise<RegexSupport>;
    onGetDynamicRules: (() => void) | null;
    onRegexCheck: (() => void) | null;
    reset: () => void;
    rules: DnrRule[];
    tested: string[];
    unsupported: string[];
    updateDynamicRules: (options: UpdateOptions) => Promise<void>;
    updateFails: boolean;
    updates: UpdateOptions[];
}

export interface DnrHeader {
    header: string;
    operation: string;
    value?: string;
}

export interface DnrRule {
    action: {
        requestHeaders?: DnrHeader[];
        responseHeaders?: DnrHeader[];
        type: string;
    };
    condition: {
        regexFilter: string;
        resourceTypes: string[];
    };
    id: number;
    priority?: number;
}

export interface EventStub<T> {
    addListener: (listener: T, filter: ListenerFilter, extra: string[]) => void;
    entries: ListenerEntry<T>[];
    fail: boolean;
    hasListener: (listener: T) => boolean;
    removeListener: (listener: T) => void;
    reset: () => void;
}

export interface HeaderDetails {
    requestHeaders?: HttpHeader[];
    responseHeaders?: HttpHeader[];
    url: string;
}

export type HeaderListener = (details: HeaderDetails) => BlockingResult;

export interface HttpHeader {
    name: string;
    value?: string;
}

export interface ListenerEntry<T> {
    extra: string[];
    filter: ListenerFilter;
    listener: T;
}

export interface ListenerFilter {
    types?: string[];
    urls: string[];
}

export interface RegexOptions {
    regex: string;
}

export interface RegexSupport {
    isSupported: boolean;
    reason?: string;
}

export interface UpdateOptions {
    addRules?: DnrRule[];
    removeRuleIds?: number[];
}

export interface WebRequestStub {
    onBeforeSendHeaders: EventStub<HeaderListener>;
    onHeadersReceived: EventStub<HeaderListener>;
    reset: () => void;
}

export function declarativeNetRequestCreate(): DeclarativeNetRequestStub {
    const stub: DeclarativeNetRequestStub = {
        concurrent: 0,
        concurrentMax: 0,
        getDynamicRules: async () => {
            stub.onGetDynamicRules?.();

            await Promise.resolve();

            return [...stub.rules];
        },
        isRegexSupported: async regexOptions => {
            stub.tested.push(regexOptions.regex);
            stub.concurrent += 1;
            stub.concurrentMax = Math.max(stub.concurrentMax, stub.concurrent);
            stub.onRegexCheck?.();

            await Promise.resolve();

            stub.concurrent -= 1;

            if (stub.unsupported.some(pattern => regexOptions.regex.includes(pattern))) {
                return { isSupported: false, reason: "syntaxError" };
            }

            return { isSupported: true };
        },
        onGetDynamicRules: null,
        onRegexCheck: null,
        reset: () => {
            stub.concurrent = 0;
            stub.concurrentMax = 0;
            stub.onGetDynamicRules = null;
            stub.onRegexCheck = null;
            stub.rules = [];
            stub.tested = [];
            stub.unsupported = [];
            stub.updateFails = false;
            stub.updates = [];
        },
        rules: [],
        tested: [],
        unsupported: [],
        updateDynamicRules: async options => {
            stub.updates.push(options);

            await Promise.resolve();

            if (stub.updateFails) throw new Error("The rule set was refused.");

            const removed = new Set(options.removeRuleIds ?? []);

            stub.rules = [
                ...stub.rules.filter(rule => !removed.has(rule.id)),
                ...options.addRules ?? [],
            ];
        },
        updateFails: false,
        updates: [],
    };

    return stub;
}

export function eventCreate<T>(): EventStub<T> {
    const stub: EventStub<T> = {
        addListener: (listener, filter, extra) => {
            if (stub.fail) throw new Error("The listener was rejected.");

            stub.entries.push({ extra, filter, listener });
        },
        entries: [],
        fail: false,
        hasListener: listener => stub.entries.some(entry => entry.listener === listener),
        removeListener: listener => {
            stub.entries = stub.entries.filter(entry => entry.listener !== listener);
        },
        reset: () => {
            stub.entries = [];
            stub.fail = false;
        },
    };

    return stub;
}

export function webRequestCreate(): WebRequestStub {
    const stub: WebRequestStub = {
        onBeforeSendHeaders: eventCreate<HeaderListener>(),
        onHeadersReceived: eventCreate<HeaderListener>(),
        reset: () => {
            stub.onBeforeSendHeaders.reset();
            stub.onHeadersReceived.reset();
        },
    };

    return stub;
}
