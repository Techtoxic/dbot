import { useEffect, useState } from 'react';
import { type CallbackResult, handleOAuthCallback } from '@/components/shared/utils/oauth/callback-handler';
import { api_base } from '@/external/bot-skeleton';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { normalizeAuthorizeResponse } from '@/external/bot-skeleton/services/api/authorize-response';
import Cookies from 'js-cookie';
import { Button } from '@deriv-com/ui';
import { requestLegacyToken } from '@deriv-com/auth-client';

const CallbackPage = () => {
    const [callbackResult, setCallbackResult] = useState<CallbackResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const processCallback = async () => {
            try {
                console.log('🔄 Processing OAuth callback...');
                console.log('🌐 Current URL:', window.location.href);
                console.log('🔍 URL Search Params:', window.location.search);
                
                const result = await handleOAuthCallback();
                setCallbackResult(result);
                
                if (result.success) {
                    await handleSuccessfulAuth(result);
                } else {
                    console.error('❌ OAuth callback failed:', result.error);
                }
            } catch (error) {
                console.error('❌ Callback processing error:', error);
                setCallbackResult({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    flow: 'unknown'
                });
            } finally {
                setIsProcessing(false);
            }
        };

        processCallback();
    }, []);

    const handleSuccessfulAuth = async (result: CallbackResult) => {
        console.log('🎉 OAuth Callback Success!');
        console.log('📋 Flow type:', result.flow);
        console.log('📋 Received result:', result);

        try {
            if (result.flow === 'oauth2' && result.accessToken) {
                // Handle OAuth 2.0 flow with access token
                console.log('🔄 Processing OAuth 2.0 authentication...');

                const legacyTokens = await requestLegacyToken(result.accessToken);

                const oAuth2Accounts: Record<string, { loginid: string; token: string; currency: string }> = {};
                const oAuth2AccountsList: Record<string, string> = {};

                Object.entries(legacyTokens).forEach(([key, value]) => {
                    if (!key.startsWith('acct')) return;

                    const tokenKey = key.replace('acct', 'token');
                    const currencyKey = key.replace('acct', 'cur');
                    const token = legacyTokens[tokenKey as keyof typeof legacyTokens];

                    if (typeof token !== 'string' || !token) return;

                    oAuth2Accounts[value] = {
                        loginid: value,
                        token,
                        currency: (legacyTokens[currencyKey as keyof typeof legacyTokens] as string) || '',
                    };
                    oAuth2AccountsList[value] = token;
                });

                if (legacyTokens.token1 && legacyTokens.acct1) {
                    localStorage.setItem('authToken', legacyTokens.token1);
                    localStorage.setItem('active_loginid', legacyTokens.acct1);
                    localStorage.setItem('callback_token', JSON.stringify(legacyTokens));
                    localStorage.setItem('clientAccounts', JSON.stringify(oAuth2Accounts));
                    localStorage.setItem('accountsList', JSON.stringify(oAuth2AccountsList));

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
            } else if (result.flow === 'legacy' && result.tokens) {
                // Handle legacy OAuth flow (existing logic)
                console.log('🔄 Processing legacy OAuth authentication...');
                const tokens = result.tokens;
                const accountsList: Record<string, string> = {};
                const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

                for (const [key, value] of Object.entries(tokens)) {
                    if (key.startsWith('acct')) {
                        const tokenKey = key.replace('acct', 'token');
                        if (tokens[tokenKey]) {
                            accountsList[value] = tokens[tokenKey];
                            clientAccounts[value] = {
                                loginid: value,
                                token: tokens[tokenKey],
                                currency: '',
                            };
                        }
                    } else if (key.startsWith('cur')) {
                        const accKey = key.replace('cur', 'acct');
                        if (tokens[accKey]) {
                            clientAccounts[tokens[accKey]].currency = value;
                        }
                    }
                }

                localStorage.setItem('accountsList', JSON.stringify(accountsList));
                localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

                // Handle legacy token authorization
                let is_token_set = false;
                const api = await generateDerivApiInstance();
                if (api && tokens.token1) {
                    try {
                        const authorize_response = await api.authorize(tokens.token1);
                        const { authorize, error } = normalizeAuthorizeResponse(authorize_response);
                        if (authorize) {
                            localStorage.setItem('callback_token', JSON.stringify(authorize));
                            api.disconnect();
                            if (!error) {
                                const clientAccountsArray = Object.values(clientAccounts);
                                const firstId = authorize?.account_list?.[0]?.loginid;
                                const filteredTokens = clientAccountsArray.filter(
                                    account => account.loginid === firstId
                                );
                                if (filteredTokens.length) {
                                    localStorage.setItem('authToken', filteredTokens[0].token);
                                    localStorage.setItem('active_loginid', filteredTokens[0].loginid);
                                    is_token_set = true;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error during legacy API authorization:', error);
                    }
                }
                if (!is_token_set) {
                    if (tokens.token1) {
                        localStorage.setItem('authToken', tokens.token1);
                    }
                    if (tokens.acct1) {
                        localStorage.setItem('active_loginid', tokens.acct1);
                    }
                }
            }

            // Trigger API base initialization after successful OAuth login.
            // init() already calls authorizeAndSubscribe() internally — no need to call it again.
            try {
                await api_base.init(true);
            } catch (error) {
                console.error('API base init failed after OAuth callback:', error);
            }

            const query_param_currency = sessionStorage.getItem('query_param_currency');
            window.location.assign(query_param_currency ? `/?account=${query_param_currency}` : '/');
        } catch (error) {
            console.error('❌ Authentication handling failed:', error);
        }
    };

    const renderContent = () => {
        if (isProcessing) {
            return (
                <div className="callback-processing">
                    <h2>Processing OAuth callback...</h2>
                    <p>Please wait while we authenticate you.</p>
                </div>
            );
        }

        if (callbackResult?.success) {
            return (
                <div className="callback-success">
                    <h2>Authentication Successful!</h2>
                    <p>Flow: {callbackResult.flow}</p>
                    <p>Redirecting you to the application...</p>
                </div>
            );
        }

        return (
            <div className="callback-error">
                <h2>Authentication Failed</h2>
                <p>Error: {callbackResult?.error || 'Unknown error occurred'}</p>
                <Button
                    className='callback-return-button'
                    onClick={() => {
                        window.location.href = '/';
                    }}
                >
                    Return to Bot
                </Button>
            </div>
        );
    };

    return (
        <div className="callback-page">
            {renderContent()}
        </div>
    );
};

export default CallbackPage;
