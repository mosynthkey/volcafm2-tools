import { ref } from 'vue';

export const SEND_MAX_ATTEMPTS = 5;
export const SEND_RETRY_DELAY_MS = 1000;

export type SendFailure = 'nak' | 'error';

export const createSendRetry = (send: () => void, delayMs = SEND_RETRY_DELAY_MS) => {
    const retrying = ref(false);
    const showErrorDialog = ref(false);
    const lastFailure = ref<SendFailure | null>(null);
    let attempts = 0;
    let retryScheduled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
    };

    const handleWriteState = (state: string) => {
        if (state === 'sending') {
            if (!retryScheduled) {
                attempts = 0;
                showErrorDialog.value = false;
            }
            retryScheduled = false;
            attempts += 1;
            return;
        }
        if (state === 'ok') {
            clearTimer();
            attempts = 0;
            retrying.value = false;
            lastFailure.value = null;
            return;
        }
        if ((state !== 'nak' && state !== 'error') || attempts === 0) return;

        lastFailure.value = state;
        clearTimer();
        if (attempts < SEND_MAX_ATTEMPTS) {
            retrying.value = true;
            retryScheduled = true;
            timer = setTimeout(() => {
                timer = null;
                send();
            }, delayMs);
            return;
        }
        retrying.value = false;
        showErrorDialog.value = true;
        attempts = 0;
    };

    return { retrying, showErrorDialog, lastFailure, handleWriteState, clearTimer };
};
