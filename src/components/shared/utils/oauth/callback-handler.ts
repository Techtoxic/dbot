/**
 * Enhanced callback handler for both OAuth2 and legacy OAuth flows
 */

import {
    isOAuth2Callback,
    isLegacyOAuthCallback,
    parseOAuth2Callback,
    retrievePKCEData,
    clearPKCEData,
    exchangeCodeForToken,
    type OAuth2Config,
} from './oauth-utils';

// OAuth2 configuration - scopes must match what is registered in developers.deriv.com
// Valid scopes: trade, account_manage (NOT read, NOT admin)
const OAUTH_CONFIG: OAuth2Config = {
    clientId: '338JkzW1UxRbtJPRKWWCu',
    redirectUri: 'https://dbotke.netlify.app/callback',
    scope: 'trade account_manage',
};

export interface CallbackResult {
    success: boolean;
    tokens?: Record<string, string>;
    accessToken?: string;
    error?: string;
    flow: 'oauth2' | 'legacy' | 'unknown';
}

/**
 * Handle OAuth callback - supports both OAuth2 and legacy flows
 */
export const handleOAuthCallback = async (): Promise<CallbackResult> => {
    console.log('Processing OAuth callback...');
    console.log('- Current URL:', window.location.href);
    console.log('- Search params:', window.location.search);
    console.log('- Hash:', window.location.hash);

    try {
        // Check if this is an OAuth2 callback (new flow) — includes error callbacks
        if (isOAuth2Callback()) {
            console.log('Detected OAuth2 callback (new flow)');
            return await handleOAuth2Callback();
        }

        // Check if this is a legacy OAuth callback
        if (isLegacyOAuthCallback()) {
            console.log('Detected legacy OAuth callback (old flow)');
            return handleLegacyOAuthCallback();
        }

        console.log('No valid OAuth callback detected');
        return {
            success: false,
            error: 'No valid OAuth callback parameters found',
            flow: 'unknown',
        };
    } catch (error) {
        console.error('OAuth callback handling failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            flow: 'unknown',
        };
    }
};

/**
 * Handle OAuth2 callback with PKCE token exchange
 */
const handleOAuth2Callback = async (): Promise<CallbackResult> => {
    console.log('Processing OAuth2 callback...');

    const { code, state, error } = parseOAuth2Callback();

    // If Deriv returned an error (e.g. invalid_scope, access_denied), handle it here
    if (error) {
        console.error('OAuth2 error from Deriv:', error);
        clearPKCEData();
        return {
            success: false,
            error: `OAuth2 error: ${error}`,
            flow: 'oauth2',
        };
    }

    if (!code || !state) {
        console.error('Missing OAuth2 parameters');
        return {
            success: false,
            error: 'Missing authorization code or state',
            flow: 'oauth2',
        };
    }

    // Retrieve and verify PKCE data — guard against null
    const pkceData = retrievePKCEData();

    if (!pkceData || !pkceData.codeVerifier) {
        console.error('Missing PKCE code verifier');
        return {
            success: false,
            error: 'Missing PKCE code verifier — session may have expired',
            flow: 'oauth2',
        };
    }

    const { codeVerifier, state: storedState } = pkceData;

    if (state !== storedState) {
        console.error('State mismatch - potential CSRF attack');
        clearPKCEData();
        return {
            success: false,
            error: 'State verification failed',
            flow: 'oauth2',
        };
    }

    console.log('State verified, exchanging code for token...');

    try {
        // Exchange authorization code for access token using correct argument order:
        // exchangeCodeForToken(code, config, codeVerifier)
        const tokenResponse = await exchangeCodeForToken(code, OAUTH_CONFIG, codeVerifier);

        console.log('OAuth2 token exchange successful');
        console.log('- Token type:', tokenResponse.token_type);
        console.log('- Expires in:', tokenResponse.expires_in);

        // Clear PKCE data after successful exchange
        clearPKCEData();

        return {
            success: true,
            accessToken: tokenResponse.access_token,
            tokens: {
                access_token: tokenResponse.access_token,
                token_type: tokenResponse.token_type,
                ...(tokenResponse.expires_in && { expires_in: tokenResponse.expires_in.toString() }),
            },
            flow: 'oauth2',
        };
    } catch (error) {
        console.error('Token exchange failed:', error);
        clearPKCEData();
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Token exchange failed',
            flow: 'oauth2',
        };
    }
};

/**
 * Handle legacy OAuth callback (existing flow)
 */
const handleLegacyOAuthCallback = (): CallbackResult => {
    console.log('Processing legacy OAuth callback...');

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const tokens: Record<string, string> = {};

    // Extract all parameters from hash
    for (const [key, value] of params.entries()) {
        tokens[key] = value;
    }

    console.log('Legacy OAuth tokens extracted:', Object.keys(tokens));

    if (tokens.access_token || tokens.token1) {
        return {
            success: true,
            tokens,
            accessToken: tokens.access_token || tokens.token1,
            flow: 'legacy',
        };
    }

    return {
        success: false,
        error: 'No access token found in legacy OAuth callback',
        flow: 'legacy',
    };
};

/**
 * Get access token for API calls
 */
export const getAccessTokenForAPI = (callbackResult: CallbackResult): string | null => {
    if (!callbackResult.success) {
        return null;
    }

    // For OAuth2 flow, use the access token with Bearer prefix
    if (callbackResult.flow === 'oauth2' && callbackResult.accessToken) {
        return callbackResult.accessToken;
    }

    // For legacy flow, use token1 or access_token
    if (callbackResult.flow === 'legacy' && callbackResult.tokens) {
        return callbackResult.tokens.token1 || callbackResult.tokens.access_token || null;
    }

    return null;
};
