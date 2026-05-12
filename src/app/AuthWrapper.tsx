import React from 'react';
import Cookies from 'js-cookie';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { normalizeAuthorizeResponse } from '@/external/bot-skeleton/services/api/authorize-response';
import { api_base } from '@/external/bot-skeleton';
import { handleOAuthCallback } from '@/components/shared/utils/oauth/callback-handler';
import { localize } from '@deriv-com/translations';
import { URLUtils } from '@deriv-com/utils';
import { requestLegacyToken } from '@deriv-com/auth-client';
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
        const legacyTokens = await requestLegacyToken(accessToken);

        const accountsList: Record<string, string> = {};
        const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

        Object.entries(legacyTokens).forEach(([key, value]) => {
            if (!key.startsWith('acct')) return;

            const tokenKey = key.replace('acct', 'token');
            const currencyKey = key.replace('acct', 'cur');
            const token = legacyTokens[tokenKey as keyof typeof legacyTokens];

            if (typeof token !== 'string' || !token) return;

            accountsList[value] = token;
            clientAccounts[value] = {
                loginid: value,
                token,
                currency: (legacyTokens[currencyKey as keyof typeof legacyTokens] as string) || '',
            };
        });

        if (legacyTokens.token1 && legacyTokens.acct1) {
            localStorage.setItem('authToken', legacyTokens.token1);
            localStorage.setItem('active_loginid', legacyTokens.acct1);
            localStorage.setItem('accountsList', JSON.stringify(accountsList));
            localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));
            localStorage.setItem('callback_token', JSON.stringify(legacyTokens));

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
        }

        await api_base.init(true);
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
