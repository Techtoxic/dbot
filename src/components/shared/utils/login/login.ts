import { forceCorrectAppId } from '../config/config';
import { getAppId } from '@/components/shared';

export const redirectToLogin = () => {
    // Force correct app ID before login
    forceCorrectAppId();

    // Get the current domain for the redirect URI
    const currentOrigin = window.location.origin;
    const redirectUri = `${currentOrigin}/callback`;

    // Debug logging
    console.log('🔍 OAuth Debug Info:');
    console.log('- Current Origin:', currentOrigin);
    console.log('- Current Hostname:', window.location.hostname);
    console.log('- Redirect URI:', redirectUri);
    console.log('- App ID:', getAppId());

    // Construct the OAuth URL with proper redirect_uri
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${getAppId()}&response_type=token&scope=read,trade,admin&l=EN&brand=waited&redirect_uri=${encodeURIComponent(redirectUri)}`;

    console.log('🔐 Full OAuth URL:', oauthUrl);
    console.log('🚀 Redirecting to OAuth...');

    window.location.href = oauthUrl;
};
