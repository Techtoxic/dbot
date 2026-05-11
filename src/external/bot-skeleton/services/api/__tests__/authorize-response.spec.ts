import { normalizeAuthorizeResponse } from '../authorize-response';

describe('normalizeAuthorizeResponse', () => {
    it('returns wrapped authorize payload', () => {
        const response = {
            authorize: {
                loginid: 'CR123',
                account_list: [{ loginid: 'CR123' }],
            },
        };

        const result = normalizeAuthorizeResponse(response);

        expect(result.error).toBeUndefined();
        expect(result.authorize?.loginid).toBe('CR123');
    });

    it('returns direct authorize payload', () => {
        const response = {
            msg_type: 'authorize',
            loginid: 'CR456',
            currency: 'USD',
            account_list: [{ loginid: 'CR456' }],
        };

        const result = normalizeAuthorizeResponse(response);

        expect(result.error).toBeUndefined();
        expect(result.authorize?.loginid).toBe('CR456');
    });

    it('returns error for invalid payload', () => {
        const result = normalizeAuthorizeResponse({ msg_type: 'ping' });

        expect(result.authorize).toBeUndefined();
        expect(result.error).toBeDefined();
    });

    it('returns error for null payload', () => {
        const result = normalizeAuthorizeResponse(null);

        expect(result.authorize).toBeUndefined();
        expect(result.error).toBeDefined();
    });

    it('accepts direct authorize shape without msg_type when required fields exist', () => {
        const result = normalizeAuthorizeResponse({
            loginid: 'CR789',
            currency: 'EUR',
            account_list: [{ loginid: 'CR789' }],
        });

        expect(result.error).toBeUndefined();
        expect(result.authorize?.loginid).toBe('CR789');
    });

    it('preserves wrapped error from authorize response', () => {
        const response = {
            authorize: {
                loginid: 'CR123',
                account_list: [{ loginid: 'CR123' }],
            },
            error: { code: 'InvalidToken' },
        };

        const result = normalizeAuthorizeResponse(response);

        expect(result.authorize?.loginid).toBe('CR123');
        expect(result.error).toEqual({ code: 'InvalidToken' });
    });
});
