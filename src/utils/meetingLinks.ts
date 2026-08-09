const GOOGLE_MEET_HOST = 'meet.google.com';
const GOOGLE_MEET_CODE = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i;
const GOOGLE_MEET_LOOKUP = /^\/lookup\/[a-z0-9]+\/?$/i;

export const normalizeMeetingLink = (value?: string | null) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    if (/^meet\.google\.com\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }

    return trimmed;
};

export const isValidMeetingLink = (value?: string | null) => {
    const normalized = normalizeMeetingLink(value);
    if (!normalized) return false;

    try {
        const url = new URL(normalized);
        if (!['http:', 'https:'].includes(url.protocol)) return false;

        if (url.hostname.toLowerCase() === GOOGLE_MEET_HOST) {
            return GOOGLE_MEET_CODE.test(url.pathname) || GOOGLE_MEET_LOOKUP.test(url.pathname);
        }

        return true;
    } catch {
        return false;
    }
};

export const openMeetingLink = (value?: string | null, onInvalid?: () => void) => {
    const normalized = normalizeMeetingLink(value);
    if (!isValidMeetingLink(normalized)) {
        onInvalid?.();
        return;
    }

    window.open(normalized, '_blank', 'noopener,noreferrer');
};

