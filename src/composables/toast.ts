import { assert } from "../assert";
import { ref } from "vue";
import type { Ref } from "vue";

export type ToastVariant = "error" | "success";

export interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

export interface ToastStore {
    dismiss: (id: number) => void;
    notify: (message: string, variant?: ToastVariant) => void;
    toasts: Ref<Toast[]>;
}

const TOAST_DURATION_MS = 2400;
const TOASTS_VISIBLE_MAX = 3;

const toasts = ref<Toast[]>([]);

let sequence = 0;

export function useToast(): ToastStore {
    function dismiss(id: number): void {
        toasts.value = toasts.value.filter(toast => toast.id !== id);
    }

    function notify(message: string, variant: ToastVariant = "success"): void {
        assert(message !== "", "a toast carries a message");

        const previous = sequence;

        sequence += 1;

        assert(sequence > previous, "the toast sequence only ever climbs");

        const id = sequence;

        toasts.value = [...toasts.value, { id, message, variant }].slice(-TOASTS_VISIBLE_MAX);

        assert(toasts.value.length <= TOASTS_VISIBLE_MAX, "the visible toasts stay within their count maximum");

        setTimeout(() => {
            dismiss(id);
        }, TOAST_DURATION_MS);
    }

    return { dismiss, notify, toasts };
}
