import { useEffect, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { Button } from '@deriv-com/ui';
import { handleOAuthCallback, type CallbackResult } from '@/components/shared/utils/oauth/callback-handler';

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
                
                // Store the access token
                localStorage.setItem('authToken', result.accessToken);
                
                // Use the access token to authorize with Deriv API
                const api = await generateDerivApiInstance();
                if (api) {
                    try {
                        // For OAuth 2.0, we need to use the access token as Bearer token
                        const { authorize, error } = await api.authorize(result.accessToken);
                        if (authorize && !error) {
                            console.log('✅ OAuth 2.0 API authorization successful');
                            localStorage.setItem('callback_token', JSON.stringify(authorize));
                            
                            // Set up account information from authorize response
                            if (authorize.account_list && authorize.account_list.length > 0) {
                                const firstAccount = authorize.account_list[0];
                                localStorage.setItem('active_loginid', firstAccount.loginid);
                                
                                // Create accounts structure for OAuth 2.0
                                const oAuth2Accounts: Record<string, any> = {};
                                const oAuth2AccountsList: Record<string, string> = {};
                                
                                authorize.account_list.forEach((account: any) => {
                                    oAuth2Accounts[account.loginid] = {
                                        loginid: account.loginid,
                                        token: result.accessToken,
                                        currency: account.currency || ''
                                    };
                                    oAuth2AccountsList[account.loginid] = result.accessToken || '';
                                });
                                
                                localStorage.setItem('clientAccounts', JSON.stringify(oAuth2Accounts));
                                localStorage.setItem('accountsList', JSON.stringify(oAuth2AccountsList));
                            }
                        } else {
                            console.error('❌ OAuth 2.0 API authorization failed:', error);
                        }
                        api.disconnect();
                    } catch (error) {
                        console.error('❌ OAuth 2.0 API authorization error:', error);
                    }
                }
            } else if (result.flow === 'legacy' && result.tokens) {
                // Handle legacy OAuth flow.
                // Deriv returns: acct1=CRxxxx, token1=xxxxxxx, cur1=USD (query params)
                const tokens = result.tokens;
                const accountsList: Record<string, string> = {};
                const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

                // Build account maps from acct/token/cur triplets
                let i = 1;
                while (tokens[`acct${i}`] && tokens[`token${i}`]) {
                    const loginid = tokens[`acct${i}`];
                    const token = tokens[`token${i}`];
                    const currency = tokens[`cur${i}`] || '';
                    accountsList[loginid] = token;
                    clientAccounts[loginid] = { loginid, token, currency };
                    i++;
                }

                localStorage.setItem('accountsList', JSON.stringify(accountsList));
                localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

                // Set the first account as the active account
                const firstLoginid = tokens['acct1'];
                const firstToken = tokens['token1'];
                if (firstLoginid && firstToken) {
                    localStorage.setItem('authToken', firstToken);
                    localStorage.setItem('active_loginid', firstLoginid);
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
