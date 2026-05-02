import { forceCorrectAppId } from '../config/config';
import { getAppId } from '@/components/shared';
import { generatePKCE, storePKCEData, buildOAuth2URL, type OAuth2Config } from '../oauth/oauth-utils';

// OAuth2 configuration with both legacy and new credentials
const OAUTH_CONFIG: OAuth2Config = {
    legacyAppId: '85159', // Legacy app ID for routing old users
    newClientId: '338FcRCgkGmDCjc6JoxXw', // New OAuth2 client ID
    redirectUri: 'https://dbotke.netlify.app/callback', // Fixed redirect URI
    scope: 'trade account_manage'
};

export const redirectToLogin = async () => {
    // Force correct app ID before login
    forceCorrectAppId();

    try {
        // Generate PKCE data for OAuth2 flow
        const pkceData = await generatePKCE();
        
        // Store PKCE data in session storage
        storePKCEData(pkceData);

        // Build OAuth2 URL with PKCE and legacy app_id for dual support
        const oauthUrl = buildOAuth2URL(OAUTH_CONFIG, pkceData);

        // Debug logging
        console.log('🔍 Dual OAuth Debug Info:');
        console.log('- Legacy App ID:', OAUTH_CONFIG.legacyAppId);
        console.log('- New Client ID:', OAUTH_CONFIG.newClientId);
        console.log('- Redirect URI:', OAUTH_CONFIG.redirectUri);
        console.log('- Code Challenge:', pkceData.codeChallenge);
        console.log('- State:', pkceData.state);
        console.log('🔐 Full OAuth2 URL:', oauthUrl);
        console.log('🚀 Redirecting to OAuth2 with dual support...');

        window.location.href = oauthUrl;
    } catch (error) {
        console.error('❌ Failed to generate PKCE or redirect to OAuth:', error);
        // Fallback to legacy OAuth if PKCE generation fails
        fallbackToLegacyOAuth();
    }
};

/**
 * Fallback to legacy OAuth flow if OAuth2 fails
 */
const fallbackToLegacyOAuth = () => {
    const currentOrigin = window.location.origin;
    const redirectUri = `${currentOrigin}/callback`;
    
    // Legacy OAuth URL
    const legacyOauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${getAppId()}&response_type=token&scope=read,trade,admin&l=EN&brand=waited&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('� Falling back to legacy OAuth:', legacyOauthUrl);
    window.location.href = legacyOauthUrl;
};
