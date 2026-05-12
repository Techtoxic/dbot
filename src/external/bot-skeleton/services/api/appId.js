import { getAppId, getSocketURL } from '@/components/shared';
import { OAuthTokenExchangeService } from '@/services/oauth-token-exchange.service';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import { getInitialLanguage } from '@deriv-com/translations';
import APIMiddleware from './api-middleware';

/**
 * Singleton instance management for DerivAPI
 */
let derivApiInstance = null;
let derivApiPromise = null;
let currentWebSocketURL = null;

/**
 * Clears the singleton instance (useful for logout or forced reconnection)
 */
export const clearDerivApiInstance = () => {
    if (derivApiInstance?.connection) {
        try {
            derivApiInstance.connection.close();
        } catch (error) {
            console.error('[DerivAPI] Error closing WebSocket:', error);
        }
    }
    derivApiInstance = null;
    derivApiPromise = null;
    currentWebSocketURL = null;
};

/**
 * Check if user is authenticated via OAuth2 flow
 */
export const isOAuth2Authenticated = () => {
    return OAuthTokenExchangeService.isAuthenticated();
};

/**
 * Generates a Deriv API instance with WebSocket connection using singleton pattern
 * Now supports async WebSocket URL fetching with authenticated OAuth2 flow
 * @param {boolean} forceNew - Force creation of new instance (default: false)
 * @returns Promise with DerivAPIBasic instance
 */
export const generateDerivApiInstance = async (forceNew = false) => {
    // If forcing new instance, clear existing one
    if (forceNew) {
        console.log('[DerivAPI] Forcing new instance creation');
        clearDerivApiInstance();
    }

    // If there's already an instance, check its state
    if (derivApiInstance) {
        const readyState = derivApiInstance.connection?.readyState;
        // Return existing instance if it's connecting or open
        if (readyState === WebSocket.CONNECTING || readyState === WebSocket.OPEN) {
            console.log('[DerivAPI] Reusing existing instance (state:', readyState, ')');
            return derivApiInstance;
        } else {
            // Connection is closed or closing, clear it
            console.log('[DerivAPI] Existing instance not usable (state:', readyState, '), creating new');
            clearDerivApiInstance();
        }
    }

    // If there's already a creation in progress, return that promise
    if (derivApiPromise) {
        console.log('[DerivAPI] Reusing existing creation promise');
        return derivApiPromise;
    }

    // Create new instance
    derivApiPromise = (async () => {
        try {
            let wsURL;
            
            // Check if user is authenticated via OAuth2
            if (isOAuth2Authenticated()) {
                // Use the authenticated WebSocket URL (includes OTP)
                wsURL = await getSocketURL();
                console.log('[DerivAPI] Using OAuth2 authenticated WebSocket URL');
            } else {
                // Fall back to legacy WebSocket URL
                const cleanedAppId = getAppId();
                wsURL = `wss://ws.derivws.com/websockets/v3?app_id=${cleanedAppId}&l=${getInitialLanguage()}&brand=deriv`;
                console.log('[DerivAPI] Using legacy WebSocket URL');
            }

            // Check if URL changed (account switch scenario)
            if (currentWebSocketURL && currentWebSocketURL !== wsURL) {
                console.log('[DerivAPI] WebSocket URL changed, clearing old instance');
                clearDerivApiInstance();
            }

            currentWebSocketURL = wsURL;

            console.log('[DerivAPI] Creating new WebSocket connection to:', wsURL);
            const deriv_socket = new WebSocket(wsURL);
            const deriv_api = new DerivAPIBasic({
                connection: deriv_socket,
                middleware: new APIMiddleware({}),
            });

            // Store the instance immediately (don't wait for connection)
            derivApiInstance = deriv_api;

            // Set up close handler to clear instance
            deriv_socket.addEventListener('close', () => {
                console.log('[DerivAPI] WebSocket connection closed');
                if (derivApiInstance === deriv_api) {
                    derivApiInstance = null;
                    currentWebSocketURL = null;
                }
            });

            // Log when connection opens
            deriv_socket.addEventListener('open', () => {
                console.log('[DerivAPI] WebSocket connection established');
            });

            deriv_socket.addEventListener('error', error => {
                console.error('[DerivAPI] WebSocket connection error:', error);
            });

            return deriv_api;
        } catch (error) {
            console.error('[DerivAPI] Error creating instance:', error);
            derivApiPromise = null;
            derivApiInstance = null;
            throw error;
        } finally {
            // Clear the promise after a short delay to allow reuse during concurrent calls
            setTimeout(() => {
                derivApiPromise = null;
            }, 100);
        }
    })();

    return derivApiPromise;
};

export const getLoginId = () => {
    const login_id = localStorage.getItem('active_loginid');
    if (login_id && login_id !== 'null') return login_id;
    return null;
};

/**
 * V2GetActiveAccountId - Get the active account ID
 * Works with both OAuth2 and legacy flows
 */
export const V2GetActiveAccountId = () => {
    const account_id = localStorage.getItem('active_loginid');
    if (account_id && account_id !== 'null') return account_id;
    return null;
};

/**
 * V2GetActiveToken - Get the active access token
 * Works with both OAuth2 and legacy flows
 */
export const V2GetActiveToken = () => {
    // First check localStorage (legacy flow)
    const token = localStorage.getItem('authToken');
    if (token && token !== 'null') return token;
    
    // Then check sessionStorage for OAuth2 flow (OIDC)
    const authInfoStr = sessionStorage.getItem('auth_info');
    if (authInfoStr) {
        try {
            const authInfo = JSON.parse(authInfoStr);
            // Check if token is not expired
            if (authInfo.access_token && authInfo.expires_at && Date.now() < authInfo.expires_at) {
                return authInfo.access_token;
            }
        } catch (e) {
            console.error('Error parsing auth_info from sessionStorage:', e);
        }
    }
    
    return null;
};

/**
 * V2GetActiveClientId - Get the active client/account ID
 * Works with both OAuth2 and legacy flows
 */
export const V2GetActiveClientId = () => {
    // First check localStorage for active_loginid (set by OAuth2 flow)
    const active_loginid = localStorage.getItem('active_loginid');
    if (active_loginid && active_loginid !== 'null') return active_loginid;
    
    // Fall back to legacy flow with accountsList
    const token = V2GetActiveToken();
    if (!token) return null;
    
    const account_list = JSON.parse(localStorage.getItem('accountsList'));
    if (account_list && account_list !== 'null') {
        const active_clientId = Object.keys(account_list).find(key => account_list[key] === token);
        if (active_clientId) return active_clientId;
    }
    
    return null;
};

export const getToken = () => {
    const active_loginid = getLoginId();
    const client_accounts = JSON.parse(localStorage.getItem('accountsList')) ?? undefined;
    const active_account = (client_accounts && client_accounts[active_loginid]) || {};
    return {
        token: active_account ?? undefined,
        account_id: active_loginid ?? undefined,
    };
};
