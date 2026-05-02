import { forceCorrectAppId } from '../config/config';
import { generatePKCE, storePKCEData, buildOAuth2URL, type OAuth2Config } from '../oauth/oauth-utils';

// OAuth2 configuration following Deriv's documentation
const OAUTH_CONFIG: OAuth2Config = {
    clientId: '338FcRCgkGmDCjc6JoxXw', // Your OAuth2 client ID
    redirectUri: 'https://dbotke.netlify.app/callback', // Your registered redirect URI
    scope: 'read trade admin'
};

export const redirectToLogin = async () => {
    try {
        console.log('🔍 Starting OAuth 2.0 flow...');
        
        // Generate PKCE data for OAuth2 flow
        const pkceData = await generatePKCE();
        
        // Store PKCE data in session storage
        storePKCEData(pkceData);

        // Build OAuth2 URL according to Deriv's documentation
        const oauthUrl = buildOAuth2URL(OAUTH_CONFIG, pkceData);

        // Debug logging
        console.log('🔍 OAuth 2.0 Debug Info:');
        console.log('- Client ID:', OAUTH_CONFIG.clientId);
        console.log('- Redirect URI:', OAUTH_CONFIG.redirectUri);
        console.log('- Scope:', OAUTH_CONFIG.scope);
        console.log('- Code Challenge:', pkceData.codeChallenge);
        console.log('- State:', pkceData.state);
        console.log('🔐 Full OAuth2 URL:', oauthUrl);
        console.log('🚀 Redirecting to OAuth2...');

        window.location.href = oauthUrl;
    } catch (error) {
        console.error('❌ Failed to start OAuth2 flow:', error);
        // Fallback to legacy OAuth if OAuth2 fails
        fallbackToLegacyOAuth();
    }
};

/**
 * Fallback to legacy OAuth flow if OAuth2 fails
 */
const fallbackToLegacyOAuth = () => {
    console.log('🔄 Falling back to legacy OAuth...');
    forceCorrectAppId();
    
    const currentOrigin = window.location.origin;
    const redirectUri = `${currentOrigin}/callback`;
    
    // Legacy OAuth URL (keeping your existing App ID)
    const legacyOauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=85159&response_type=token&scope=read,trade,admin&l=EN&brand=waited&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    console.log('� Legacy OAuth URL:', legacyOauthUrl);
    window.location.href = legacyOauthUrl;
};
