import { useEffect, useState } from 'react';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { api_base } from '@/external/bot-skeleton';

const CallbackPage = () => {
    const [status, setStatus] = useState('Processing login...');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Parse tokens from URL params (Deriv passes them as query params)
                const params = new URLSearchParams(window.location.search);
                const tokens: Record<string, string> = {};
                params.forEach((value, key) => {
                    tokens[key] = value;
                });

                console.log('🎉 OAuth Callback - URL params:', tokens);

                if (!tokens.token1 && !tokens.acct1) {
                    setStatus('No tokens found. Redirecting...');
                    window.location.href = '/';
                    return;
                }

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
                        if (tokens[accKey] && clientAccounts[tokens[accKey]]) {
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
                        if (authorize && !error) {
                            localStorage.setItem('callback_token', JSON.stringify(authorize));
                            api.disconnect();
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
                    } catch (error) {
                        console.error('Error during API authorization:', error);
                    }
                }

                if (!is_token_set) {
                    if (tokens.token1) localStorage.setItem('authToken', tokens.token1);
                    if (tokens.acct1) localStorage.setItem('active_loginid', tokens.acct1);
                }

                try {
                    await api_base.init(true);
                    await api_base.authorizeAndSubscribe();
                } catch (error) {
                    console.error('API base authorization failed:', error);
                }

                setStatus('Login successful! Redirecting...');
                const query_param_currency = sessionStorage.getItem('query_param_currency');
                window.location.assign(query_param_currency ? `/?account=${query_param_currency}` : '/');
            } catch (err) {
                console.error('Callback error:', err);
                setStatus('Login failed. Redirecting...');
                setTimeout(() => { window.location.href = '/'; }, 2000);
            }
        };

        handleCallback();
    }, []);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
            <div>{status}</div>
            <button onClick={() => { window.location.href = '/'; }} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                Return to Bot
            </button>
        </div>
    );
};

export default CallbackPage;
