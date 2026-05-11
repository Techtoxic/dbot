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
});
