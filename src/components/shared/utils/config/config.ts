import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import brandConfig from '../../../../../brand.config.json';

// =============================================================================
// Constants - App ID Configuration (from original dbot)
// =============================================================================

// app_id=133723 is registered for dbotke.netlify.app with scopes: read, trade
export const CURRENT_APP_ID = '133723';

export const APP_IDS = {
    LOCALHOST: CURRENT_APP_ID,
    TMP_STAGING: CURRENT_APP_ID,
    STAGING: CURRENT_APP_ID,
    STAGING_BE: CURRENT_APP_ID,
    STAGING_ME: CURRENT_APP_ID,
    PRODUCTION: CURRENT_APP_ID,
    PRODUCTION_BE: CURRENT_APP_ID,
    PRODUCTION_ME: CURRENT_APP_ID,
    LIVE: CURRENT_APP_ID,
};

export const domain_app_ids = {
    'master.bot-standalone.pages.dev': APP_IDS.TMP_STAGING,
    'staging-dbot.deriv.com': APP_IDS.STAGING,
    'staging-dbot.deriv.be': APP_IDS.STAGING_BE,
    'staging-dbot.deriv.me': APP_IDS.STAGING_ME,
    'dbot.deriv.com': APP_IDS.PRODUCTION,
    'dbot.deriv.be': APP_IDS.PRODUCTION_BE,
    'dbot.deriv.me': APP_IDS.PRODUCTION_ME,
    'bot.derivlite.com': APP_IDS.LIVE,
    'scofieldtradings.netlify.app': APP_IDS.LIVE,
    'dbotke.netlify.app': APP_IDS.LIVE,
};

// =============================================================================
// Constants - Domain & Server Configuration (from brand.config.json)
// =============================================================================

// Production app domains
export const PRODUCTION_DOMAINS = {
    COM: brandConfig.platform.hostname.production.com,
} as const;

// Staging app domains
export const STAGING_DOMAINS = {
    COM: brandConfig.platform.hostname.staging.com,
} as const;

// WebSocket server URLs
export const WS_SERVERS = {
    STAGING: `${brandConfig.platform.derivws.url.staging}options/ws/public`,
    PRODUCTION: `${brandConfig.platform.derivws.url.production}options/ws/public`,
} as const;

// =============================================================================
// Helper Functions - Domain Detection
// =============================================================================

export const getCurrentProductionDomain = () =>
    !/^staging\./.test(window.location.hostname) &&
    Object.keys(domain_app_ids).find(domain => window.location.hostname === domain);

// Helper to check if we're on production domains
export const isProduction = () => {
    const hostname = window.location.hostname;
    const productionDomains = Object.values(PRODUCTION_DOMAINS) as string[];
    // Also check domain_app_ids for production check
    const all_domains = Object.keys(domain_app_ids).map(domain => `(www\\.)?${domain.replace(/\./g, '\\.')}`);
    return productionDomains.includes(hostname) || new RegExp(`^(${all_domains.join('|')})$`, 'i').test(hostname);
};

export const isTestLink = () => {
    return (
        window.location.origin?.includes('.binary.sx') ||
        window.location.origin?.includes('bot-65f.pages.dev') ||
        isLocal()
    );
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

// =============================================================================
// App ID Functions (from original dbot)
// =============================================================================

export const getAppId = () => {
    let app_id = window.localStorage.getItem('config.app_id');

    // Force the correct app ID if it's wrong or missing
    if (!app_id || app_id === '69811' || app_id === '96171' || app_id !== CURRENT_APP_ID) {
        console.warn("⚠️ App ID is invalid or outdated, forcing correct App ID...");
        console.log("🔄 Old App ID:", app_id, "-> New App ID:", CURRENT_APP_ID);
        app_id = CURRENT_APP_ID;
        window.localStorage.setItem('config.app_id', app_id);
    }

    return app_id;
};

// Force clear old app ID and set correct one
export const forceCorrectAppId = () => {
    const currentAppId = window.localStorage.getItem('config.app_id');
    if (currentAppId !== CURRENT_APP_ID) {
        console.log("🔄 Forcing correct App ID update...");
        console.log("🗑️ Clearing old App ID:", currentAppId);
        window.localStorage.removeItem('config.app_id');
        window.localStorage.setItem('config.app_id', CURRENT_APP_ID);
        console.log("✅ Set new App ID:", CURRENT_APP_ID);
    }
};

export const getDefaultAppIdAndUrl = () => {
    const server_url = getDefaultServerURL();
    const current_domain = getCurrentProductionDomain() ?? '';
    const app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids] ?? APP_IDS.LIVE;

    return { app_id, server_url };
};

// =============================================================================
// Server URL Functions
// =============================================================================

const getDefaultServerURL = () => {
    if (isTestLink()) {
        return 'ws.derivws.com';
    }

    const searchParams = new URLSearchParams(window.location.search);
    const active_loginid_from_url = searchParams.get('acct1');

    const loginid = window.localStorage.getItem('active_loginid') ?? active_loginid_from_url;
    const is_real = loginid && !/^(VRT|VRW)/.test(loginid);

    return `${is_real ? 'green' : 'blue'}.derivws.com`;
};

/**
 * Gets the WebSocket URL using the new authenticated flow
 */
export const getSocketURL = async (): Promise<string> => {
    try {
        // Check if user is authenticated
        const authInfo = OAuthTokenExchangeService.getAuthInfo();
        if (!authInfo || !authInfo.access_token) {
            return getDefaultServerURL();
        }

        // Use the DerivWSAccountsService to get authenticated WebSocket URL
        const wsUrl = await DerivWSAccountsService.getAuthenticatedWebSocketURL(authInfo.access_token);
        return wsUrl;
    } catch (error) {
        console.error('[DerivWS] Error in getSocketURL:', error);
        return getDefaultServerURL();
    }
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

// =============================================================================
// PKCE & CSRF Functions (OAuth2)
// =============================================================================

/**
 * Generates a cryptographically secure CSRF token
 */
const generateCSRFToken = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Generates a PKCE code verifier (random string)
 */
const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Generates a PKCE code challenge from a code verifier using SHA-256
 */
const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Stores PKCE code verifier in sessionStorage
 */
const storeCodeVerifier = (verifier: string): void => {
    sessionStorage.setItem('oauth_code_verifier', verifier);
    sessionStorage.setItem('oauth_code_verifier_timestamp', Date.now().toString());
};

/**
 * Retrieves and validates the stored PKCE code verifier
 */
export const getCodeVerifier = (): string | null => {
    const verifier = sessionStorage.getItem('oauth_code_verifier');
    const timestamp = sessionStorage.getItem('oauth_code_verifier_timestamp');

    if (!verifier || !timestamp) {
        return null;
    }

    const verifierAge = Date.now() - parseInt(timestamp, 10);
    if (verifierAge > 600000) {
        sessionStorage.removeItem('oauth_code_verifier');
        sessionStorage.removeItem('oauth_code_verifier_timestamp');
        return null;
    }

    return verifier;
};

/**
 * Clears PKCE code verifier from sessionStorage
 */
export const clearCodeVerifier = (): void => {
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_code_verifier_timestamp');
};

/**
 * Stores CSRF token in sessionStorage
 */
const storeCSRFToken = (token: string): void => {
    sessionStorage.setItem('oauth_csrf_token', token);
    sessionStorage.setItem('oauth_csrf_token_timestamp', Date.now().toString());
};

/**
 * Validates CSRF token from OAuth callback
 */
export const validateCSRFToken = (token: string): boolean => {
    const storedToken = sessionStorage.getItem('oauth_csrf_token');
    const timestamp = sessionStorage.getItem('oauth_csrf_token_timestamp');

    if (!storedToken || !timestamp) {
        return false;
    }

    if (storedToken !== token) {
        return false;
    }

    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > 600000) {
        sessionStorage.removeItem('oauth_csrf_token');
        sessionStorage.removeItem('oauth_csrf_token_timestamp');
        return false;
    }

    return true;
};

/**
 * Clears CSRF token from sessionStorage
 */
export const clearCSRFToken = (): void => {
    sessionStorage.removeItem('oauth_csrf_token');
    sessionStorage.removeItem('oauth_csrf_token_timestamp');
};

/**
 * Generates OAuth URL with PKCE support
 */
export const generateOAuthURL = async (prompt?: string) => {
    try {
        const environment = isProduction() ? 'production' : 'staging';
        const hostname = brandConfig?.platform.auth2_url?.[environment];
        const clientId = '33fkQaqUK4Drz5HopZ1Aj';

        if (hostname && clientId) {
            const csrfToken = generateCSRFToken();
            storeCSRFToken(csrfToken);

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            storeCodeVerifier(codeVerifier);

            const protocol = window.location.protocol;
            const host = window.location.host;
            const redirectUrl = `${protocol}//${host}`;
            const scopes = 'trade';

            let oauthUrl = `${hostname}auth?scope=${scopes}&response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${csrfToken}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

            if (prompt) {
                oauthUrl += `&prompt=${encodeURIComponent(prompt)}`;
            }

            const appId = process.env.APP_ID;
            if (appId) {
                oauthUrl += `&app_id=${encodeURIComponent(appId)}`;
            }

            return oauthUrl;
        }
    } catch (error) {
        console.error('Error generating OAuth URL:', error);
    }

    return ``;
};
