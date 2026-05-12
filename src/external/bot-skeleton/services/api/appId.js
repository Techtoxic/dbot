import { getAppId } from '@/components/shared';
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import { getInitialLanguage } from '@deriv-com/translations';
import APIMiddleware from './api-middleware';

export const generateDerivApiInstance = () => {
        // Use numeric app_id (85159) for WebSocket — the alphanumeric OAuth2 client_id is ONLY for the OAuth login URL
        const cleanedAppId = getAppId();
        // brand must be 'deriv' — Deriv's WebSocket server does not accept custom brand names
        const socket_url = `wss://ws.derivws.com/websockets/v3?app_id=${cleanedAppId}&l=${getInitialLanguage()}&brand=deriv`;
        const deriv_socket = new WebSocket(socket_url);
        const deriv_api = new DerivAPIBasic({
                connection: deriv_socket,
                middleware: new APIMiddleware({}),
        });
        return deriv_api;
};

export const getLoginId = () => {
        const login_id = localStorage.getItem('active_loginid');
        if (login_id && login_id !== 'null') return login_id;
        return null;
};

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

export const V2GetActiveClientId = () => {
        const token = V2GetActiveToken();

        if (!token) return null;
        
        // First try to get from accountsList (legacy flow)
        const account_list = JSON.parse(localStorage.getItem('accountsList'));
        if (account_list && account_list !== 'null') {
                const active_clientId = Object.keys(account_list).find(key => account_list[key] === token);
                if (active_clientId) return active_clientId;
        }
        
        // Fall back to active_loginid (OAuth2 flow stores this during auth)
        const active_loginid = localStorage.getItem('active_loginid');
        if (active_loginid && active_loginid !== 'null') return active_loginid;
        
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
