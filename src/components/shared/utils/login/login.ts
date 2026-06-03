import { getAppId } from '@/components/shared';

export const redirectToLogin = () => {
    const redirectUri = window.location.origin;
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${getAppId()}&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = oauthUrl;
};
