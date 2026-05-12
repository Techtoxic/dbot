/**
 * OAuth2 utilities with PKCE support for new Deriv users
 */

// OAuth2 configuration interface
export interface OAuth2Config {
    clientId: string;
    redirectUri: string;
    scope: string;
}

// PKCE data interface
export interface PKCEData {
    codeVerifier: string;
    codeChallenge: string;
    state: string;
}

/**
 * Generate PKCE (Proof Key for Code Exchange) data for OAuth2 flow
 * Following Deriv's OAuth 2.0 documentation
 */
export const generatePKCE = async (): Promise<PKCEData> => {
    // 1. Generate a random code_verifier
    const array = crypto.getRandomValues(new Uint8Array(64));
    const codeVerifier = Array.from(array)
        .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
        .join('');

    // 2. Derive the code_challenge
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    // 3. Generate a random state for CSRF protection
    const state = crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

    return {
        codeVerifier,
        codeChallenge,
        state,
    };
};

/**
 * Store PKCE data in session storage
 * Following Deriv's OAuth 2.0 documentation
 */
export const storePKCEData = (pkceData: PKCEData): void => {
    sessionStorage.setItem('pkce_code_verifier', pkceData.codeVerifier);
    sessionStorage.setItem('oauth_state', pkceData.state);
    console.log('PKCE data stored in session storage');
};

/**
 * Retrieve PKCE data from session storage
 */
export const retrievePKCEData = (): PKCEData | null => {
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
    const state = sessionStorage.getItem('oauth_state');

    if (!codeVerifier || !state) {
        console.warn('PKCE data not found in session storage');
        return null;
    }

    return {
        codeVerifier,
        codeChallenge: '', // Not needed for retrieval
        state,
    };
};

/**
 * Clear PKCE data from session storage
 */
export const clearPKCEData = (): void => {
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');
    console.log('PKCE data cleared from session storage');
};

/**
 * Build OAuth2 authorization URL according to Deriv's documentation
 * Uses https://auth.deriv.com/oauth2/auth endpoint
 */
export const buildOAuth2URL = (config: OAuth2Config, pkceData: PKCEData): string => {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scope,
        state: pkceData.state,
        code_challenge: pkceData.codeChallenge,
        code_challenge_method: 'S256',
    });

    return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (
    code: string,
    config: OAuth2Config,
    codeVerifier: string
): Promise<{ access_token: string; token_type: string; expires_in?: number }> => {
    const response = await fetch('https://auth.deriv.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code,
            code_verifier: codeVerifier,
            redirect_uri: config.redirectUri,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return response.json();
};

/**
 * Check if current URL contains OAuth2 callback parameters.
 * Handles both success (code + state) and error (error + state) responses.
 */
export const isOAuth2Callback = (): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    return (urlParams.has('code') && urlParams.has('state')) || (urlParams.has('error') && urlParams.has('state'));
};

/**
 * Check if current URL contains legacy OAuth callback parameters
 */
export const isLegacyOAuthCallback = (): boolean => {
    const hash = window.location.hash;
    return hash.includes('access_token=') || hash.includes('token1=');
};

/**
 * Parse OAuth2 callback parameters from URL
 */
export const parseOAuth2Callback = (): { code: string | null; state: string | null; error: string | null } => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        code: urlParams.get('code'),
        state: urlParams.get('state'),
        error: urlParams.get('error'),
    };
};
