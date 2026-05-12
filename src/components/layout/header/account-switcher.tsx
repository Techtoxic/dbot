import { useEffect } from 'react';
import { lazy, Suspense, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { CurrencyIcon } from '@/components/currency/currency-icon';
import { addComma, getDecimalPlaces } from '@/components/shared';
import Popover from '@/components/shared_ui/popover';
import { api_base } from '@/external/bot-skeleton';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { waitForDomElement } from '@/utils/dom-observer';
// Trial account login IDs for marketing purposes
const TRIAL_ACCOUNT_IDS = ['VRTC7579953'];

// Check if a login ID is a trial account
const isTrialAccount = (loginId?: string | null): boolean => {
    if (!loginId) return false;
    return TRIAL_ACCOUNT_IDS.includes(loginId);
};

// Get display currency for trial accounts
const getDisplayCurrency = (loginId?: string | null, originalCurrency?: string): string => {
    if (isTrialAccount(loginId)) {
        return 'USD';
    }
    return originalCurrency || 'USD';
};

// Get display account type for trial accounts (unused but kept for consistency)
// const getDisplayAccountType = (loginId?: string | null, isVirtual?: boolean): boolean => {
//     if (isTrialAccount(loginId)) {
//         return false; // Show as real account for marketing
//     }
//     return isVirtual || false;
// };
import { localize } from '@deriv-com/translations';
import { AccountSwitcher as UIAccountSwitcher, Loader, useDevice } from '@deriv-com/ui';
import DemoAccounts from './common/demo-accounts';
import RealAccounts from './common/real-accounts';
import { TAccountSwitcher, TAccountSwitcherProps, TModifiedAccount } from './common/types';
import { LOW_RISK_COUNTRIES } from './utils';
import './account-switcher.scss';

const AccountInfoWallets = lazy(() => import('./wallets/account-info-wallets'));

const tabs_labels = {
    demo: localize('Demo'),
    real: localize('Real'),
};

const RenderAccountItems = ({
    isVirtual,
    modifiedCRAccountList,
    modifiedMFAccountList,
    modifiedVRTCRAccountList,
    switchAccount,
    activeLoginId,
    client,
}: TAccountSwitcherProps) => {
    const { oAuthLogout } = useOauth2({ handleLogout: async () => client.logout(), client });
    const is_low_risk_country = LOW_RISK_COUNTRIES().includes(client.account_settings?.country_code ?? '');
    const is_virtual = !!isVirtual;

    useEffect(() => {
        // Update the max-height from the accordion content set from deriv-com/ui
        const parent_container = document.getElementsByClassName('account-switcher-panel')?.[0] as HTMLDivElement;
        if (!isVirtual && parent_container) {
            parent_container.style.maxHeight = '70vh';
            waitForDomElement('.deriv-accordion__content', parent_container)?.then((accordionElement: unknown) => {
                const element = accordionElement as HTMLDivElement;
                if (element) {
                    element.style.maxHeight = '70vh';
                }
            });
        }
    }, [isVirtual]);

    if (is_virtual) {
        return (
            <>
                <DemoAccounts
                    modifiedVRTCRAccountList={modifiedVRTCRAccountList as TModifiedAccount[]}
                    switchAccount={switchAccount}
                    activeLoginId={activeLoginId}
                    isVirtual={is_virtual}
                    tabs_labels={tabs_labels}
                    oAuthLogout={oAuthLogout}
                    is_logging_out={client.is_logging_out}
                />
            </>
        );
    } else {
        return (
            <RealAccounts
                modifiedCRAccountList={modifiedCRAccountList as TModifiedAccount[]}
                modifiedMFAccountList={modifiedMFAccountList as TModifiedAccount[]}
                switchAccount={switchAccount}
                isVirtual={is_virtual}
                tabs_labels={tabs_labels}
                is_low_risk_country={is_low_risk_country}
                oAuthLogout={oAuthLogout}
                loginid={activeLoginId}
                is_logging_out={client.is_logging_out}
            />
        );
    }
};

const AccountSwitcher = observer(({ activeAccount }: TAccountSwitcher) => {
    const { isDesktop } = useDevice();
    const { accountList } = useApiBase();
    const { ui, run_panel, client } = useStore();

    // Create modified active account for trial accounts
    const modifiedActiveAccount = useMemo(() => {
        if (!activeAccount) return activeAccount;

        const isTrial = isTrialAccount(activeAccount.loginid);
        const displayCurrency = getDisplayCurrency(activeAccount.loginid, activeAccount.currency);

        return {
            ...activeAccount,
            currency: displayCurrency,
            is_virtual: isTrial ? false : activeAccount.is_virtual,
            icon: (
                <CurrencyIcon
                    currency={displayCurrency?.toLowerCase()}
                    isVirtual={isTrial ? false : Boolean(activeAccount.is_virtual)}
                    accountLoginId={activeAccount.loginid}
                />
            ),
        };
    }, [activeAccount]);
    const { accounts } = client;
    const { toggleAccountsDialog, is_accounts_switcher_on, account_switcher_disabled_message } = ui;
    const { is_stop_button_visible } = run_panel;
    const has_wallet = Object.keys(accounts).some(id => accounts[id].account_category === 'wallet');

    const modifiedAccountList = useMemo(() => {
        return accountList?.map(account => {
            // Check if this is a trial account
            const isTrial = isTrialAccount(account?.loginid);
            const displayCurrency = getDisplayCurrency(account?.loginid, account?.currency);
            // const displayAccountType = getDisplayAccountType(account?.loginid, Boolean(account?.is_virtual));

            return {
                ...account,
                balance: addComma(
                    client.all_accounts_balance?.accounts?.[account?.loginid]?.balance?.toFixed(
                        getDecimalPlaces(displayCurrency)
                    ) ?? '0'
                ),
                currencyLabel: isTrial
                    ? 'USD' // Always show USD for trial accounts
                    : account?.is_virtual
                      ? tabs_labels.demo
                      : (client.website_status?.currencies_config?.[account?.currency]?.name ?? account?.currency),
                icon: (
                    <CurrencyIcon
                        currency={displayCurrency?.toLowerCase()}
                        isVirtual={isTrial ? false : Boolean(account?.is_virtual)} // Show as real account for trial accounts
                        accountLoginId={account?.loginid}
                    />
                ),
                isVirtual: isTrial ? false : Boolean(account?.is_virtual), // Show as real account for trial accounts
                isActive: account?.loginid === activeAccount?.loginid,
            };
        });
    }, [
        accountList,
        client.all_accounts_balance?.accounts,
        client.website_status?.currencies_config,
        activeAccount?.loginid,
    ]);
    const modifiedCRAccountList = useMemo(() => {
        return modifiedAccountList?.filter(account => account?.loginid?.includes('CR')) ?? [];
    }, [modifiedAccountList]);

    const modifiedMFAccountList = useMemo(() => {
        return modifiedAccountList?.filter(account => account?.loginid?.includes('MF')) ?? [];
    }, [modifiedAccountList]);

    const modifiedVRTCRAccountList = useMemo(() => {
        return modifiedAccountList?.filter(account => account?.loginid?.includes('VRT')) ?? [];
    }, [modifiedAccountList]);

    const switchAccount = async (loginId: number) => {
        if (loginId.toString() === activeAccount?.loginid) return;
        const account_list = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
        const token = account_list[loginId];
        if (!token) return;
        localStorage.setItem('authToken', token);
        localStorage.setItem('active_loginid', loginId.toString());
        await api_base?.init(true);
        const search_params = new URLSearchParams(window.location.search);
        const selected_account = modifiedAccountList.find(acc => acc.loginid === loginId.toString());
        if (!selected_account) return;

        // Handle trial accounts - always show USD in URL
        const isTrial = isTrialAccount(loginId.toString());
        const account_param = isTrial ? 'USD' : selected_account.is_virtual ? 'demo' : selected_account.currency;

        search_params.set('account', account_param);
        window.history.pushState({}, '', `${window.location.pathname}?${search_params.toString()}`);
    };

    return (
        activeAccount &&
        (has_wallet ? (
            <Suspense fallback={<Loader />}>
                <AccountInfoWallets is_dialog_on={is_accounts_switcher_on} toggleDialog={toggleAccountsDialog} />
            </Suspense>
        ) : (
            <Popover
                className='run-panel__info'
                classNameBubble='run-panel__info--bubble'
                alignment='bottom'
                message={account_switcher_disabled_message}
                zIndex='5'
            >
                <UIAccountSwitcher
                    activeAccount={modifiedActiveAccount}
                    isDisabled={is_stop_button_visible}
                    tabsLabels={tabs_labels}
                    modalContentStyle={{
                        content: {
                            top: isDesktop ? '30%' : '50%',
                            borderRadius: '10px',
                        },
                    }}
                >
                    <UIAccountSwitcher.Tab title={tabs_labels.real}>
                        <RenderAccountItems
                            modifiedCRAccountList={modifiedCRAccountList as TModifiedAccount[]}
                            modifiedMFAccountList={modifiedMFAccountList as TModifiedAccount[]}
                            switchAccount={switchAccount}
                            activeLoginId={activeAccount?.loginid}
                            client={client}
                        />
                    </UIAccountSwitcher.Tab>
                    <UIAccountSwitcher.Tab title={tabs_labels.demo}>
                        <RenderAccountItems
                            modifiedVRTCRAccountList={modifiedVRTCRAccountList as TModifiedAccount[]}
                            switchAccount={switchAccount}
                            isVirtual
                            activeLoginId={activeAccount?.loginid}
                            client={client}
                        />
                    </UIAccountSwitcher.Tab>
                </UIAccountSwitcher>
            </Popover>
        ))
    );
});

export default AccountSwitcher;
