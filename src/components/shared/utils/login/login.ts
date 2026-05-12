import { forceCorrectAppId } from '../config/config';
import { generatePKCE, storePKCEData, buildOAuth2URL, type OAuth2Config } from '../oauth/oauth-utils';

const REDIRECT_URI = 'https://dbotke.netlify.app/callback';

// OAuth2 configuration following Deriv's documentation at developers.deriv.com
// Valid Deriv scopes: read, trade, trading_information, payments, admin
// Use only 'trade' — the minimum scope needed for a trading bot
const OAUTH_CONFIG: OAuth2Config = {
    clientId: '33fkQaqUK4Drz5HopZ1Aj',
    redirectUri: REDIRECT_URI,
    scope: 'trade'
};

export const redirectToLogin = async () => {
    try {
        console.log('Starting OAuth 2.0 flow...');
        
        // Generate PKCE data for OAuth2 flow
        const pkceData = await generatePKCE();
        
        // Store PKCE data in session storage before redirecting
        storePKCEData(pkceData);

        // Build OAuth2 URL according to Deriv's documentation
        const oauthUrl = buildOAuth2URL(OAUTH_CONFIG, pkceData);

        console.log('OAuth 2.0 Debug Info:');
        console.log('- Client ID:', OAUTH_CONFIG.clientId);
        console.log('- Redirect URI:', OAUTH_CONFIG.redirectUri);
        console.log('- Scope:', OAUTH_CONFIG.scope);
        console.log('Redirecting to OAuth2...');

        window.location.href = oauthUrl;
    } catch (error) {
        console.error('Failed to start OAuth2 flow:', error);
        // Fallback to legacy OAuth if OAuth2 fails
        fallbackToLegacyOAuth();
    }
};

/**
 * Fallback to legacy OAuth flow if OAuth2 fails
 * Uses the legacy app_id for the old oauth.deriv.com endpoint
 * Valid legacy scopes: read, trade, payments, admin, trading_information
 */
const fallbackToLegacyOAuth = () => {
    console.log('Falling back to legacy OAuth...');
    forceCorrectAppId();
    
    const legacyOauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=133723&response_type=token&scope=read,trade&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    
    console.log('Legacy OAuth URL:', legacyOauthUrl);
    window.location.href = legacyOauthUrl;
};
