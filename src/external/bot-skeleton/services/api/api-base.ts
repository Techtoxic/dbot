import CommonStore from '@/stores/common-store';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { TAuthData } from '@/types/api-types';
import { observer as globalObserver } from '../../utils/observer';
import { doUntilDone, socket_state } from '../tradeEngine/utils/helpers';
import {
    CONNECTION_STATUS,
    setAccountList,
    setAuthData,
    setConnectionStatus,
    setIsAuthorized,
    setIsAuthorizing,
} from './observables/connection-status-stream';
import ApiHelpers from './api-helpers';
import { generateDerivApiInstance, isOAuth2Authenticated, V2GetActiveAccountId, V2GetActiveClientId, V2GetActiveToken } from './appId';
import { normalizeAuthorizeResponse } from './authorize-response';
import chart_api from './chart-api';

const AUTHORIZE_TIMEOUT_MS = 12000;

type CurrentSubscription = {
    id: string;
    unsubscribe: () => void;
};

type SubscriptionPromise = Promise<{
    subscription: CurrentSubscription;
}>;

type TApiBaseApi = {
    connection: {
        readyState: keyof typeof socket_state;
        addEventListener: (event: string, callback: () => void) => void;
        removeEventListener: (event: string, callback: () => void) => void;
    };
    send: (data: unknown) => void;
    disconnect: () => void;
    authorize: (token: string) => Promise<{ authorize: TAuthData; error: unknown }>;
    balance: () => Promise<{ balance: any; error: unknown }>;
    getSelfExclusion: () => Promise<unknown>;
    onMessage: () => {
        subscribe: (callback: (message: unknown) => void) => {
            unsubscribe: () => void;
        };
    };
} & ReturnType<typeof generateDerivApiInstance>;

/**
 * Helper function to check if account is demo based on loginid prefix
 */
const isDemoAccount = (loginid: string | undefined): boolean => {
    if (!loginid) return false;
    return loginid.startsWith('VRT') || loginid.startsWith('VRTC');
};

class APIBase {
    api: TApiBaseApi | null = null;
    token: string = '';
    account_id: string = '';
    pip_sizes = {};
    account_info = {};
    is_running = false;
    subscriptions: CurrentSubscription[] = [];
    time_interval: ReturnType<typeof setInterval> | null = null;
    has_active_symbols = false;
    is_stopping = false;
    active_symbols = [];
    current_auth_subscriptions: SubscriptionPromise[] = [];
    is_authorized = false;
    active_symbols_promise: Promise<void> | null = null;
    common_store: CommonStore | undefined;
    landing_company: string | null = null;

    unsubscribeAllSubscriptions = () => {
        this.current_auth_subscriptions?.forEach(subscription_promise => {
            subscription_promise.then(({ subscription }) => {
                if (subscription?.id) {
                    this.api?.send({
                        forget: subscription.id,
                    });
                }
            });
        });
        this.current_auth_subscriptions = [];
    };

    onsocketopen() {
        setConnectionStatus(CONNECTION_STATUS.OPENED);
    }

    onsocketclose() {
        setConnectionStatus(CONNECTION_STATUS.CLOSED);
        this.reconnectIfNotConnected();
    }

    async init(force_create_connection = false) {
        this.toggleRunButton(true);

        if (this.api) {
            this.unsubscribeAllSubscriptions();
        }

        if (!this.api || this.api?.connection.readyState !== 1 || force_create_connection) {
            if (this.api?.connection) {
                ApiHelpers.disposeInstance();
                setConnectionStatus(CONNECTION_STATUS.CLOSED);
                this.api.disconnect();
                this.api.connection.removeEventListener('open', this.onsocketopen.bind(this));
                this.api.connection.removeEventListener('close', this.onsocketclose.bind(this));
            }
            // generateDerivApiInstance is now async
            this.api = await generateDerivApiInstance();
            this.api?.connection.addEventListener('open', this.onsocketopen.bind(this));
            this.api?.connection.addEventListener('close', this.onsocketclose.bind(this));
        }

        // Check if we should authorize - for OAuth2, check if we have an active account
        const hasActiveAccount = V2GetActiveAccountId();
        const hasToken = V2GetActiveToken();
        
        if (!this.has_active_symbols && !hasActiveAccount && !hasToken) {
            this.active_symbols_promise = this.getActiveSymbols();
        }

        this.initEventListeners();

        if (this.time_interval) clearInterval(this.time_interval);
        this.time_interval = null;

        // Authorize if we have credentials (OAuth2 or legacy)
        if (hasActiveAccount || hasToken) {
            setIsAuthorizing(true);
            await this.authorizeAndSubscribe();
        }

        chart_api.init(force_create_connection);
    }

    getConnectionStatus() {
        if (this.api?.connection) {
            const ready_state = this.api.connection.readyState;
            return socket_state[ready_state as keyof typeof socket_state] || 'Unknown';
        }
        return 'Socket not initialized';
    }

    terminate() {
        // eslint-disable-next-line no-console
        if (this.api) this.api.disconnect();
    }

    initEventListeners() {
        if (window) {
            window.addEventListener('online', this.reconnectIfNotConnected);
            window.addEventListener('focus', this.reconnectIfNotConnected);
        }
    }

    async createNewInstance(account_id: string) {
        if (this.account_id !== account_id) {
            await this.init();
        }
    }

    reconnectIfNotConnected = () => {
        // eslint-disable-next-line no-console
        console.log('connection state: ', this.api?.connection?.readyState);
        if (this.api?.connection?.readyState && this.api?.connection?.readyState > 1) {
            // eslint-disable-next-line no-console
            console.log('Info: Connection to the server was closed, trying to reconnect.');
            this.init(true);
        }
    };

    async authorizeAndSubscribe() {
        if (!this.api) return;

        // Check if using OAuth2 flow
        if (isOAuth2Authenticated()) {
            return this.authorizeWithOAuth2();
        }
        
        // Fall back to legacy token-based authorization
        return this.authorizeWithLegacyToken();
    }

    /**
     * OAuth2 authorization flow
     * In OAuth2, the WebSocket URL is already authenticated via OTP,
     * so we just need to call balance API to get account info
     */
    async authorizeWithOAuth2() {
        if (!this.api) return;

        this.account_id = V2GetActiveAccountId() || '';
        
        try {
            // In OAuth2, the WebSocket is pre-authenticated via OTP
            // We just need to call balance to get the account info
            const { balance, error } = await this.api.balance();

            if (error) {
                console.error('OAuth2 authorization error:', error);
                setIsAuthorizing(false);
                throw new Error(typeof error === 'object' && 'message' in error ? (error as any).message : 'Authorization failed');
            }

            this.account_info = {
                balance: balance?.balance,
                currency: balance?.currency,
                loginid: balance?.loginid,
            };
            this.token = balance?.loginid;

            const isDemo = isDemoAccount(balance?.loginid);
            const currentAccount = balance?.loginid
                ? {
                      balance: balance.balance,
                      currency: balance.currency || 'USD',
                      is_virtual: isDemo ? 1 : 0,
                      loginid: balance.loginid,
                  }
                : null;

            // Build full account list from sessionStorage (populated during OAuth flow)
            const storedAccounts = DerivWSAccountsService.getStoredAccounts();
            const accountList =
                storedAccounts && storedAccounts.length > 0
                    ? storedAccounts
                          .filter(a => !a.status || a.status === 'active')
                          .map(a => ({
                              balance: parseFloat(a.balance) || 0,
                              currency: a.currency || 'USD',
                              is_virtual: a.account_type === 'demo' ? 1 : 0,
                              loginid: a.account_id,
                          }))
                    : currentAccount
                      ? [currentAccount]
                      : [];

            setAccountList(accountList);
            setAuthData({
                balance: balance?.balance,
                currency: balance?.currency,
                loginid: balance?.loginid,
                is_virtual: isDemo ? 1 : 0,
                account_list: accountList,
            });

            // Set account_type in localStorage
            if (isDemo) {
                localStorage.setItem('account_type', 'demo');
            } else {
                localStorage.setItem('account_type', 'real');
            }

            globalObserver.emit('api.authorize', {
                account_list: accountList,
                current_account: {
                    loginid: balance?.loginid,
                    currency: balance?.currency || 'USD',
                    is_virtual: isDemo ? 0 : 1,
                    balance: typeof balance?.balance === 'number' ? balance.balance : undefined,
                },
            });

            setIsAuthorized(true);
            this.is_authorized = true;
            localStorage.setItem('client_account_details', JSON.stringify(accountList));
            localStorage.setItem('client.country', balance?.country);

            if (balance?.loginid) {
                localStorage.setItem('active_loginid', balance.loginid);
            }

            if (this.has_active_symbols) {
                this.toggleRunButton(false);
            } else {
                this.active_symbols_promise = this.getActiveSymbols();
            }
            
            this.subscribe();
            console.log('[APIBase] OAuth2 authorization successful:', balance?.loginid);
        } catch (e) {
            this.is_authorized = false;
            setIsAuthorized(false);
            globalObserver.emit('Error', e);
            console.error('[APIBase] OAuth2 authorization failed:', e);
        } finally {
            setIsAuthorizing(false);
        }
    }

    /**
     * Legacy token-based authorization flow
     */
    async authorizeWithLegacyToken() {
        const token = V2GetActiveToken();
        if (!token) return;

        this.token = token;
        this.account_id = V2GetActiveClientId() ?? '';

        if (!this.api) return;

        try {
            // Race authorize against a 12-second timeout
            const authorizeTimeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Authorize timed out after 12 seconds')), AUTHORIZE_TIMEOUT_MS)
            );
            const authorize_response = await Promise.race([this.api.authorize(this.token), authorizeTimeout]);
            const { authorize, error } = normalizeAuthorizeResponse(authorize_response);
            if (error || !authorize) {
                if (error instanceof Error) {
                    throw error;
                }
                const error_details = (() => {
                    if (!error) return 'Empty authorize payload';
                    try {
                        return JSON.stringify(error);
                    } catch {
                        return String(error);
                    }
                })();
                throw new Error(`Authorize failed: ${error_details}`);
            }

            if (this.has_active_symbols) {
                this.toggleRunButton(false);
            } else {
                this.active_symbols_promise = this.getActiveSymbols();
            }
            this.account_info = authorize;
            setAccountList(authorize.account_list);
            setAuthData(authorize);
            setIsAuthorized(true);
            this.is_authorized = true;
            this.subscribe();
            this.getSelfExclusion();
        } catch (e) {
            this.is_authorized = false;
            setIsAuthorized(false);
            globalObserver.emit('Error', e);
        } finally {
            setIsAuthorizing(false);
        }
    }

    async getSelfExclusion() {
        if (!this.api || !this.is_authorized) return;
        await this.api.getSelfExclusion();
        // TODO: fix self exclusion
    }

    async subscribe() {
        const subscribeToStream = (streamName: string) => {
            return doUntilDone(
                () => {
                    const subscription = this.api?.send({
                        [streamName]: 1,
                        subscribe: 1,
                        ...(streamName === 'balance' ? { account: 'all' } : {}),
                    });
                    if (subscription) {
                        this.current_auth_subscriptions.push(subscription);
                    }
                    return subscription;
                },
                [],
                this
            );
        };

        const streamsToSubscribe = ['balance', 'transaction', 'proposal_open_contract'];

        await Promise.all(streamsToSubscribe.map(subscribeToStream));
    }

    getActiveSymbols = async () => {
        await doUntilDone(() => this.api?.send({ active_symbols: 'brief' }), [], this).then(
            ({ active_symbols = [], error = {} }) => {
                const pip_sizes = {};
                if (active_symbols.length) this.has_active_symbols = true;
                active_symbols.forEach(({ symbol, pip }: { symbol: string; pip: string }) => {
                    (pip_sizes as Record<string, number>)[symbol] = +(+pip).toExponential().substring(3);
                });
                this.pip_sizes = pip_sizes as Record<string, number>;
                this.toggleRunButton(false);
                this.active_symbols = active_symbols;
                return active_symbols || error;
            }
        ).catch((err: unknown) => {
            // Catch errors (e.g. InvalidAppID) so they don't close the socket and trigger a reconnect loop
            // eslint-disable-next-line no-console
            console.warn('getActiveSymbols failed, will retry after reconnect:', err);
            this.toggleRunButton(false);
        });
    };

    toggleRunButton = (toggle: boolean) => {
        const run_button = document.querySelector('#db-animation__run-button');
        if (!run_button) return;
        (run_button as HTMLButtonElement).disabled = toggle;
    };

    setIsRunning(toggle = false) {
        this.is_running = toggle;
    }

    pushSubscription(subscription: CurrentSubscription) {
        this.subscriptions.push(subscription);
    }

    clearSubscriptions() {
        this.subscriptions.forEach(s => s.unsubscribe());
        this.subscriptions = [];

        // Resetting timeout resolvers
        const global_timeouts = globalObserver.getState('global_timeouts') ?? [];

        global_timeouts.forEach((_: unknown, i: number) => {
            clearTimeout(i);
        });
    }
}

export const api_base = new APIBase();
