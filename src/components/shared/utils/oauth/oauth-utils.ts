/**
 * OAuth2 utilities with PKCE support for both legacy and new Deriv users
 */

export interface OAuth2Config {
    legacyAppId: string;
    newClientId: string;
    redirectUri: string;
    scope: string;
}

export interface PKCEData {
    codeVerifier: string;
    codeChallenge: string;
    state: string;
}

/**
 * Generate PKCE code verifier, challenge, and state for OAuth2 flow
 */
export const generatePKCE = async (): Promise<PKCEData> => {
    // Generate code verifier (43-128 characters, URL-safe)
    const array = crypto.getRandomValues(new Uint8Array(64));
    const codeVerifier = Array.from(array)
        .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
        .join('');

    // Generate code challenge (SHA256 hash of verifier, base64url encoded)
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    // Generate state (random string for CSRF protection)
    const state = crypto.getRandomValues(new Uint8Array(16))
        .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

    return {
        codeVerifier,
        codeChallenge,
        state
    };
};

/**
 * Store PKCE data in session storage
 */
export const storePKCEData = (pkceData: PKCEData): void => {
    sessionStorage.setItem('pkce_code_verifier', pkceData.codeVerifier);
    sessionStorage.setItem('oauth_state', pkceData.state);
};

/**
 * Retrieve PKCE data from session storage
 */
export const retrievePKCEData = (): { codeVerifier: string | null; state: string | null } => {
    return {
        codeVerifier: sessionStorage.getItem('pkce_code_verifier'),
        state: sessionStorage.getItem('oauth_state')
    };
};

/**
 * Clear PKCE data from session storage
 */
export const clearPKCEData = (): void => {
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');
};

/**
 * Build OAuth2 authorization URL with PKCE support for both legacy and new users
 */
export const buildOAuth2URL = (config: OAuth2Config, pkceData: PKCEData): string => {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.newClientId,
        redirect_uri: config.redirectUri,
        scope: config.scope,
        state: pkceData.state,
        code_challenge: pkceData.codeChallenge,
        code_challenge_method: 'S256',
        app_id: config.legacyAppId // Critical for legacy user routing
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
            client_id: config.newClientId,
            code,
            code_verifier: codeVerifier,
            redirect_uri: config.redirectUri
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return response.json();
};

/**
 * Check if current URL contains OAuth2 callback parameters
 */
export const isOAuth2Callback = (): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('code') && urlParams.has('state');
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
        error: urlParams.get('error')
    };
};
