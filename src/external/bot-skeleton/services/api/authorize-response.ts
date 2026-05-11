import { TAuthData } from '@/types/api-types';

type TAuthorizeResponse = {
    authorize?: TAuthData;
    error?: unknown;
};

export const normalizeAuthorizeResponse = (response: unknown): TAuthorizeResponse => {
    if (!response || typeof response !== 'object') {
        return { error: new Error('Invalid authorize response') };
    }

    const data = response as Record<string, unknown>;
    const authorizeData =
        typeof data.authorize === 'object' && data.authorize ? (data.authorize as TAuthData) : undefined;

    if (authorizeData) {
        return {
            authorize: authorizeData,
            error: data.error,
        };
    }

    const has_loginid = typeof data.loginid === 'string' && data.loginid.length > 0;
    const has_account_list = Array.isArray(data.account_list);
    const has_currency = typeof data.currency === 'string' && data.currency.length > 0;
    const isAuthorizePayload = data.msg_type === 'authorize' || (has_loginid && has_account_list && has_currency);

    if (isAuthorizePayload) {
        return {
            authorize: data as unknown as TAuthData,
            error: data.error,
        };
    }

    return { error: data.error ?? new Error('Invalid authorize response') };
};
