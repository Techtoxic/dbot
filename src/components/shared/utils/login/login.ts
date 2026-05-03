import { getAppId } from '@/components/shared';

const REDIRECT_URI = 'https://dbotke.netlify.app/callback';

/**
 * Redirect to Deriv's legacy OAuth endpoint.
 *
 * The Deriv WebSocket API's `authorize` call expects a legacy API token
 * (the acct/token/cur params returned by oauth.deriv.com), NOT an OAuth2
 * Bearer access token. The OAuth2/PKCE flow returns a Bearer token that
 * cannot be passed to `api.authorize()`, so we always use the legacy flow.
 */
export const redirectToLogin = () => {
    const appId = getAppId();
    const legacyOauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&response_type=token&scope=read,trade&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.href = legacyOauthUrl;
};
