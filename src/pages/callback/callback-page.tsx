import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { api_base } from '@/external/bot-skeleton';
import { Callback } from '@deriv-com/auth-client';
import { Button } from '@deriv-com/ui';

const CallbackPage = () => {
    return (
        <Callback
            onSignInSuccess={async (tokens: Record<string, string>) => {
                console.log('🎉 OAuth Callback Success!');
                console.log('📋 Received tokens:', tokens);
                console.log('🌐 Current URL:', window.location.href);
                console.log('🔍 URL Search Params:', window.location.search);
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

                let is_token_set = false;
                const api = await generateDerivApiInstance();
                if (api && tokens.token1) {
                    try {
                        const { authorize, error } = await api.authorize(tokens.token1);
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
                        console.error('Error during API authorization:', error);
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

                // Trigger API base authorization after successful OAuth login
                try {
                    console.log('🔄 Triggering API base authorization...');
                    // Reinitialize API base to ensure fresh connection
                    await api_base.init(true);
                    await api_base.authorizeAndSubscribe();
                    console.log('✅ API base authorization completed');
                } catch (error) {
                    console.error('❌ API base authorization failed:', error);
                }

                const query_param_currency = sessionStorage.getItem('query_param_currency');
                window.location.assign(query_param_currency ? `/?account=${query_param_currency}` : '/');
            }}
            renderReturnButton={() => {
                return (
                    <Button
                        className='callback-return-button'
                        onClick={() => {
                            window.location.href = '/';
                        }}
                    >
                        {'Return to Bot'}
                    </Button>
                );
            }}
        />
    );
};

export default CallbackPage;
