import React from 'react';
import Cookies from 'js-cookie';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { normalizeAuthorizeResponse } from '@/external/bot-skeleton/services/api/authorize-response';
import { api_base } from '@/external/bot-skeleton';
import { handleOAuthCallback } from '@/components/shared/utils/oauth/callback-handler';
import { localize } from '@deriv-com/translations';
import { URLUtils } from '@deriv-com/utils';
import App from './App';

const setLocalStorageToken = async (loginInfo: URLUtils.LoginInfo[], paramsToDelete: string[]) => {
    if (loginInfo.length) {
        try {
            const defaultActiveAccount = URLUtils.getDefaultActiveAccount(loginInfo);
            if (!defaultActiveAccount) return;

            const accountsList: Record<string, string> = {};
            const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

            loginInfo.forEach((account: { loginid: string; token: string; currency: string }) => {
                accountsList[account.loginid] = account.token;
                clientAccounts[account.loginid] = account;
            });

            localStorage.setItem('accountsList', JSON.stringify(accountsList));
            localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

            URLUtils.filterSearchParams(paramsToDelete);
            const api = await generateDerivApiInstance();

            if (api) {
                const authorize_response = await api.authorize(loginInfo[0].token);
                const { authorize, error } = normalizeAuthorizeResponse(authorize_response);
                api.disconnect();
                if (!error) {
                    const firstId = authorize?.account_list[0]?.loginid;
                    const filteredTokens = loginInfo.filter(token => token.loginid === firstId);
                    if (filteredTokens.length) {
                        localStorage.setItem('authToken', filteredTokens[0].token);
                        localStorage.setItem('active_loginid', filteredTokens[0].loginid);
                        return;
                    }
                }
            }

            localStorage.setItem('authToken', loginInfo[0].token);
            localStorage.setItem('active_loginid', loginInfo[0].loginid);
        } catch (error) {
            console.error('Error setting up login info:', error);
        }
    }
};

const setOAuth2LocalStorageToken = async (accessToken: string) => {
    try {
        // Store the OAuth 2.0 access token in session storage
        // api_base.init(true) will handle websocket authorization using this token
        console.log('🔄 Storing OAuth 2.0 access token...');
        sessionStorage.setItem('auth_info', JSON.stringify({
            access_token: accessToken,
            token_type: 'bearer',
            expires_at: Date.now() + 3600000  
        }));

        // Set login cookie for OIDC flow recognition
        const domains = ['deriv.com', 'deriv.dev', 'binary.sx', 'pages.dev', 'localhost', 'deriv.be', 'deriv.me'];
        const currentDomain = window.location.hostname.split('.').slice(-2).join('.');
        if (domains.includes(currentDomain)) {
            Cookies.set('logged_state', 'true', {
                expires: 30,
                path: '/',
                domain: currentDomain,
                secure: true,
            });
        }

        // Initialize websocket auth - api_base will handle account authorization
        // using the stored access_token from sessionStorage
        console.log('🔌 Initializing websocket connection...');
        await api_base.init(true);
        
        console.log('✅ OAuth 2.0 authentication completed!');
    } catch (error) {
        console.error('Error setting up OAuth2 login info:', error);
    }
};

export const AuthWrapper = () => {
    const [isAuthComplete, setIsAuthComplete] = React.useState(false);

    React.useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                const callbackResult = await handleOAuthCallback();

                if (callbackResult.success && callbackResult.flow === 'oauth2' && callbackResult.accessToken) {
                    await setOAuth2LocalStorageToken(callbackResult.accessToken);
                    const query_param_currency = sessionStorage.getItem('query_param_currency');
                    window.history.replaceState(
                        {},
                        '',
                        query_param_currency ? `/?account=${query_param_currency}` : '/'
                    );
                    return;
                }

                const { loginInfo, paramsToDelete } = URLUtils.getLoginInfoFromURL();
                await setLocalStorageToken(loginInfo, paramsToDelete);
                URLUtils.filterSearchParams(['lang']);
            } finally {
                if (isMounted) {
                    setIsAuthComplete(true);
                }
            }
        };

        initializeAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    if (!isAuthComplete) {
        return <ChunkLoader message={localize('Initializing...')} />;
    }

    return <App />;
};
