import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import ChunkLoader from '@/components/loader/chunk-loader';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base, load, updateWorkspaceName } from '@/external/bot-skeleton';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import simpleCopyTradingService from '../../services/simple-copy-trading';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import './copy-trading.css';

const Chart = lazy(() => import('../chart'));
const Tutorial = lazy(() => import('../tutorials'));
const AnalysistoolComponent = lazy(
    () => import('../../components/analysistool/analysis')
) as React.LazyExoticComponent<React.FC<{ isActive?: boolean }>>;

// Debug logging gate
const DEBUG = false;
const logInfo = (...args: unknown[]) => {
    if (DEBUG) console.log(...args);
};
const logWarn = (...args: unknown[]) => {
    if (DEBUG) console.warn(...args);
};

// Simple DTrader fallback component
const DTrader = lazy(() => {
    return import('../dashboard/dtrader').catch((error: unknown) => {
        logWarn('Failed to load DTrader:', error);
        return {
            default: () => (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '500px',
                        flexDirection: 'column',
                        gap: '20px',
                        color: '#666',
                        padding: '2rem',
                        textAlign: 'center',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        margin: '1rem',
                    }}
                >
                    <div style={{ fontSize: '3rem' }}>📊</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '600', color: '#333' }}>DTrader Coming Soon</div>
                    <div style={{ fontSize: '1rem', maxWidth: '500px', lineHeight: '1.6', color: '#666' }}>
                        The advanced trading interface is being prepared for you. In the meantime, you can use the Bot
                        Builder to create automated trading strategies.
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: '1rem',
                            marginTop: '1rem',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                        }}
                    >
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '12px 24px',
                                background: '#4bb4b7',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: '500',
                            }}
                        >
                            Refresh Page
                        </button>
                        {/* Removed noisy onClick console log */}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#999', fontStyle: 'italic', marginTop: '1rem' }}>
                        Component failed to load. Please refresh the page.
                    </div>
                </div>
            ),
        };
    });
});

const DashboardIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='4' y='4' width='7' height='7' rx='1.4' fill='currentColor' />
        <rect x='13' y='4' width='7' height='4' rx='1.2' fill='currentColor' opacity='0.72' />
        <rect x='13' y='10' width='7' height='10' rx='1.2' fill='currentColor' opacity='0.84' />
        <rect x='4' y='13' width='7' height='7' rx='1.4' fill='currentColor' opacity='0.92' />
    </svg>
);

const BotBuilderIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='4' y='4' width='5.5' height='5.5' rx='1.2' fill='currentColor' />
        <rect x='14.5' y='4' width='5.5' height='5.5' rx='1.2' fill='currentColor' opacity='0.74' />
        <rect x='9.25' y='14.5' width='5.5' height='5.5' rx='1.2' fill='currentColor' opacity='0.9' />
        <path d='M9 7.5H15M12 10.5V14M7 7.8V11.5M17 7.8V11.5' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
    </svg>
);

const ChartsIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M4 19H20' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M4 19V5' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M6 15L9 12L12 14L17 8' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='6' cy='15' r='1.1' fill='currentColor' />
        <circle cx='9' cy='12' r='1.1' fill='currentColor' opacity='0.85' />
        <circle cx='12' cy='14' r='1.1' fill='currentColor' opacity='0.85' />
        <circle cx='17' cy='8' r='1.1' fill='currentColor' />
    </svg>
);

const TutorialsIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='4' y='4' width='16' height='16' rx='4' stroke='currentColor' strokeWidth='1.7' />
        <path d='M10 8.2L16 12L10 15.8V8.2Z' fill='currentColor' />
    </svg>
);

const AnalysisToolIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M6 5V19' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='6' cy='9' r='1.6' fill='currentColor' />
        <path d='M12 5V19' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='12' cy='15' r='1.6' fill='currentColor' />
        <path d='M18 5V19' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='18' cy='11' r='1.6' fill='currentColor' />
    </svg>
);

const SignalsIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M4 7H20' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M4 12H20' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M4 17H20' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='7.5' cy='7' r='1.2' fill='currentColor' />
        <circle cx='12' cy='12' r='1.2' fill='currentColor' opacity='0.85' />
        <circle cx='16.5' cy='17' r='1.2' fill='currentColor' opacity='0.7' />
    </svg>
);

const TradingHubIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <circle cx='12' cy='12' r='2.2' fill='currentColor' />
        <circle cx='5.5' cy='7' r='1.25' fill='currentColor' opacity='0.7' />
        <circle cx='18.5' cy='7' r='1.25' fill='currentColor' opacity='0.7' />
        <circle cx='5.5' cy='17' r='1.25' fill='currentColor' opacity='0.7' />
        <circle cx='18.5' cy='17' r='1.25' fill='currentColor' opacity='0.7' />
        <path d='M6.5 7.8L10 10M17.5 7.8L14 10M6.5 16.2L10 14M17.5 16.2L14 14' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
    </svg>
);

const FreeBotsIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='4' y='4' width='6' height='6' rx='1.4' fill='currentColor' opacity='0.94' />
        <rect x='14' y='4' width='6' height='6' rx='1.4' fill='currentColor' opacity='0.72' />
        <rect x='4' y='14' width='6' height='6' rx='1.4' fill='currentColor' opacity='0.72' />
        <rect x='14' y='14' width='6' height='6' rx='1.4' fill='currentColor' opacity='0.94' />
    </svg>
);

const BulkTradingIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M4 6H20L18.5 10H5.5L4 6Z' stroke='currentColor' strokeWidth='1.7' strokeLinejoin='round' />
        <path d='M5.5 10H18.5L17.2 18H6.8L5.5 10Z' stroke='currentColor' strokeWidth='1.7' strokeLinejoin='round' />
        <path d='M9 13H15M9 16H13' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
);

const CopyTradingIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='4' y='5' width='10' height='13' rx='2' stroke='currentColor' strokeWidth='1.5' opacity='0.55' />
        <rect x='10' y='3' width='10' height='13' rx='2' stroke='currentColor' strokeWidth='1.7' />
        <path d='M13 7H18M13 10H18M13 13H16' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
);

const BotIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.6' />
        <circle cx='9.5' cy='11' r='1.1' fill='currentColor' />
        <circle cx='14.5' cy='11' r='1.1' fill='currentColor' />
        <path d='M9 15C10.2 15.9 13.8 15.9 15 15' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
    </svg>
);

const DTraderIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M4 19V5' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M4 19H20' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M6.5 15L10 11L13 14L18 8.5' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='10' cy='11' r='1.1' fill='currentColor' />
        <circle cx='13' cy='14' r='1.1' fill='currentColor' opacity='0.82' />
        <circle cx='18' cy='8.5' r='1.1' fill='currentColor' />
    </svg>
);

// Error Boundary for DTrader
class DTraderErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logWarn('DTrader Error Boundary caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '500px',
                        flexDirection: 'column',
                        gap: '20px',
                        color: '#666',
                        padding: '2rem',
                        textAlign: 'center',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        margin: '1rem',
                    }}
                >
                    <div style={{ fontSize: '3rem' }}>⚠️</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '600', color: '#333' }}>DTrader Error</div>
                    <div style={{ fontSize: '1rem', maxWidth: '500px', lineHeight: '1.6', color: '#666' }}>
                        The trading interface encountered an error. Please refresh the page to try again.
                    </div>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false });
                            window.location.reload();
                        }}
                        style={{
                            padding: '12px 24px',
                            background: '#ff444f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: '500',
                        }}
                    >
                        Refresh Page
                    </button>
                    <div style={{ fontSize: '0.9rem', color: '#999', fontStyle: 'italic', marginTop: '1rem' }}>
                        Error: {this.state.error?.message || 'Unknown error'}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { client, dashboard, load_modal, run_panel, summary_card } = useStore();
    const { active_tab, is_chart_modal_visible, setActiveTab } = dashboard;
    const { onEntered } = load_modal;
    const {
        is_dialog_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
        is_drawer_open,
    } = run_panel;
    const { cancel_button_text, ok_button_text, title, message } = dialog_options as { [key: string]: string };
    const { clear } = summary_card;
    const { isDesktop } = useDevice();

    const [bots, setBots] = useState<Array<{ title: string; image: string; filePath: string; xmlContent: string }>>([]);
    // const [copyTradingEnabled, setCopyTradingEnabled] = useState(false); // Moved to CopyTradingComponent
    // const [realAccountBalance, setRealAccountBalance] = useState(0); // Moved to CopyTradingComponent
    // const [demoAccountBalance] = useState(10000); // Moved to derivAccounts

    // Copy trading state
    const [copyTradingEnabled, setCopyTradingEnabled] = useState(() => {
        const saved = localStorage.getItem('copyTradingEnabled');
        return saved === 'true';
    });
    const [realAccountBalance, setRealAccountBalance] = useState(0);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);

    useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
            }
        }
    }, [clear, connectionStatus, stopBot]);

    useEffect(() => {
        const fetchBots = async () => {
            const botFiles = [
                'EVEN_ODD MYTH V1.xml',
                'EVEN MYTH V2.0.xml',
                'ODD MYTH V2.xml',
                'REBORN.xml',
                'OVER 1 BLACKLIST .xml',
                'dec under 8  special.xml',
                'mega mind.xml',
                'Over the years .xml',
                'dec  entry point.xml',
                'DREAMERS PACK.XML',
                'SMART DIGIT BOT.xml',
                'UNDER 9 5 OVER 3.xml',
                'Reborn HnR.xml',
            ];
            const botPromises = botFiles.map(async file => {
                try {
                    const response = await fetch(file);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
                    }
                    const text = await response.text();
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(text, 'application/xml');
                    return {
                        title: file.split('/').pop() || file,
                        image: xml.getElementsByTagName('image')[0]?.textContent || 'default_image_path',
                        filePath: file,
                        xmlContent: text,
                    };
                } catch (error) {
                    console.error(error);
                    return null;
                }
            });
            const bots = (await Promise.all(botPromises)).filter(Boolean) as Array<{
                title: string;
                image: string;
                filePath: string;
                xmlContent: string;
            }>;
            setBots(bots);
        };

        fetchBots();
    }, []);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            logInfo('Tab changed to index:', tab_index);
            setActiveTab(tab_index);
        },
        [setActiveTab]
    );

    const handleBotClick = useCallback(
        async (bot: { title: string; filePath: string; xmlContent: string }) => {
            setActiveTab(DBOT_TABS.BOT_BUILDER);
            try {
                logInfo('Loading bot:', bot.title, bot.filePath);

                // Load the bot using the load function
                await load({
                    block_string: bot.xmlContent,
                    file_name: bot.title,
                    workspace: (window as { Blockly?: { derivWorkspace?: unknown } }).Blockly?.derivWorkspace,
                    from: save_types.UNSAVED,
                    drop_event: {},
                    strategy_id: null,
                    showIncompatibleStrategyDialog: false,
                });

                if ((window as any).Blockly?.derivWorkspace) {
                    (window as any).Blockly.derivWorkspace.strategy_to_load = bot.xmlContent;
                }

                updateWorkspaceName();
                logInfo('Bot loaded successfully!');
            } catch (error) {
                console.error('Error loading bot file:', error);
            }
        },
        [setActiveTab]
    );

    const handleOpen = useCallback(async () => {
        await load_modal.loadFileFromRecent();
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    }, [load_modal, setActiveTab]);

    const handleBulkTradingBotClick = useCallback(async () => {
        setActiveTab(DBOT_TABS.BOT_BUILDER);
        try {
            // Ensure Blockly workspace and custom blocks are ready before loading XML
            const waitForBlockly = async (timeoutMs = 5000) => {
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                    const Blockly = (window as { Blockly?: any }).Blockly;
                    if (Blockly?.derivWorkspace && Blockly?.Blocks && Blockly.Blocks.apollo_purchase) {
                        return Blockly;
                    }
                    await new Promise(r => setTimeout(r, 100));
                }
                throw new Error('Blockly not ready');
            };

            const response = await fetch('BULK_TRADING_APOLLO_DIGITS.xml');
            if (!response.ok) throw new Error('Failed to fetch BULK_TRADING_APOLLO_DIGITS.xml');
            const bulkTradingBotXML = await response.text();

            const Blockly = await waitForBlockly();

            // Ensure any unknown block types in the XML are stub-registered before loading
            try {
                const xmlDoc = new DOMParser().parseFromString(bulkTradingBotXML, 'application/xml');
                const xmlBlocks = Array.from(xmlDoc.getElementsByTagName('block'));
                const rawTypes = xmlBlocks.map(node => node.getAttribute('type'));
                const blockTypes: string[] = Array.from(new Set(rawTypes.filter((t): t is string => !!t)));
                const blocksRegistry: Record<string, any> = Blockly.Blocks as any;
                blockTypes.forEach((type) => {
                    if (!Object.prototype.hasOwnProperty.call(blocksRegistry, type)) {
                        blocksRegistry[type] = {
                            init() {
                                this.jsonInit({
                                    message0: type,
                                    previousStatement: null,
                                    nextStatement: null,
                                    colour: Blockly.Colours?.Base?.colour || 210,
                                    colourSecondary: Blockly.Colours?.Base?.colourSecondary || 210,
                                    colourTertiary: Blockly.Colours?.Base?.colourTertiary || 210,
                                });
                            },
                        } as any;
                        (Blockly.JavaScript.javascriptGenerator.forBlock as any)[type] = () => '';
                    }
                });
            } catch (e) {
                // Fall through; loader will still handle errors
            }

            await load({
                block_string: bulkTradingBotXML,
                file_name: 'Bulk Trading Apollo Digits',
                workspace: Blockly.derivWorkspace,
                from: save_types.UNSAVED,
                drop_event: {},
                strategy_id: null,
                showIncompatibleStrategyDialog: false,
            });

            if (Blockly?.derivWorkspace) {
                (Blockly.derivWorkspace as { strategy_to_load?: string }).strategy_to_load = bulkTradingBotXML;
            }

            updateWorkspaceName();
            logInfo('Bulk Trading Bot loaded successfully!');
        } catch (error) {
            console.error('Error loading Bulk Trading Bot:', error);
            alert('Failed to load Bulk Trading Bot. Please try again.');
        }
    }, [setActiveTab]);

    // Fetch real account balance from client store
    const fetchRealAccountBalance = useCallback(async () => {
        try {
            if (!client) {
                console.log('Client not available');
                setRealAccountBalance(0);
                return;
            }

            setIsLoadingBalance(true);

            // Get all accounts and find the real account (not virtual)
            const allAccounts = client.all_accounts_balance?.accounts;
            if (!allAccounts || Object.keys(allAccounts).length === 0) {
                console.log('No accounts balance data available');
                setRealAccountBalance(0);
                return;
            }

            // Find the real account (non-virtual account)
            const accountList = Object.values(allAccounts);
            const realAccount = accountList.find((account: unknown) => {
                return account && typeof account === 'object' && !(account as { is_virtual?: boolean }).is_virtual;
            });

            if (realAccount && (realAccount as { balance?: string | number }).balance !== undefined) {
                const accountBalance = (realAccount as { balance?: string | number }).balance;
                const balance = typeof accountBalance === 'string' ? parseFloat(accountBalance) : accountBalance || 0;
                setRealAccountBalance(balance);
                if (simpleCopyTradingService) {
                    simpleCopyTradingService.updateRealAccountBalance(balance);
                }
                console.log(
                    'Real account balance fetched:',
                    balance,
                    'Currency:',
                    (realAccount as { currency?: string }).currency
                );
            } else {
                console.log('No real account found, falling back to current account balance');
                // Fallback to current account balance if no real account found
                const fallbackBalance = parseFloat(client.balance) || 0;
                setRealAccountBalance(fallbackBalance);
                if (simpleCopyTradingService) {
                    simpleCopyTradingService.updateRealAccountBalance(fallbackBalance);
                }
                console.log('Fallback balance:', fallbackBalance);
            }
        } catch (error) {
            console.error('Failed to fetch real account balance:', error);
            setRealAccountBalance(0);
        } finally {
            setIsLoadingBalance(false);
        }
    }, [client]);

    // Copy trading toggle
    const handleCopyTradingToggle = useCallback(async () => {
        if (!copyTradingEnabled) {
            // Fetch real account balance before enabling
            await fetchRealAccountBalance();

            if (realAccountBalance === 0) {
                alert('No balance in real account. Copy trading requires a real account with funds.');
                return;
            }

            // Enable copy trading
            simpleCopyTradingService.enableCopyTrading(realAccountBalance);
            setCopyTradingEnabled(true);
            localStorage.setItem('copyTradingEnabled', 'true');
            logInfo('Copy trading enabled');
        } else {
            // Disable copy trading
            simpleCopyTradingService.disableCopyTrading();
            setCopyTradingEnabled(false);
            localStorage.setItem('copyTradingEnabled', 'false');
            logInfo('Copy trading disabled');
        }
    }, [copyTradingEnabled, realAccountBalance, fetchRealAccountBalance]);

    // Fetch real account balance on component mount and set up copy trading
    useEffect(() => {
        try {
            // Add a small delay to ensure client data is loaded
            const timer = setTimeout(() => {
                fetchRealAccountBalance();
            }, 1000);

            // Set up global demo trade monitoring
            const handleDemoTrade = (event: CustomEvent) => {
                if (copyTradingEnabled && simpleCopyTradingService) {
                    simpleCopyTradingService.processDemoTrade(event.detail);
                }
            };

            // Listen for demo trade events
            window.addEventListener('demo-trade-executed', handleDemoTrade as EventListener);

            return () => {
                clearTimeout(timer);
                window.removeEventListener('demo-trade-executed', handleDemoTrade as EventListener);
            };
        } catch (error) {
            console.error('Error in copy trading setup:', error);
        }
    }, [fetchRealAccountBalance, copyTradingEnabled]);

    // Refresh balance when all_accounts_balance changes
    useEffect(() => {
        try {
            if (client?.all_accounts_balance?.accounts) {
                fetchRealAccountBalance();
            }
        } catch (error) {
            console.error('Error refreshing balance:', error);
        }
    }, [fetchRealAccountBalance]);

    // Set up global demo trade emitter for copy trading
    useEffect(() => {
        try {
            // Make the demo trade emitter available globally
            (window as { emitDemoTrade?: (tradeData: unknown) => void }).emitDemoTrade = (tradeData: unknown) => {
                const event = new CustomEvent('demo-trade-executed', { detail: tradeData });
                window.dispatchEvent(event);
            };
        } catch (error) {
            console.error('Error setting up demo trade emitter:', error);
        }
    }, []);

    // Copy trading signals are processed internally by service. No-op here to avoid unused vars.

    const showRunPanel = [
        DBOT_TABS.BOT_BUILDER,
        DBOT_TABS.DTRADER,
        DBOT_TABS.CHART,
        DBOT_TABS.ANALYSIS_TOOL,
        DBOT_TABS.BULK_TRADING,
        DBOT_TABS.COPY_TRADING,
        DBOT_TABS.SIGNALS,
    ].includes(active_tab);

    // Optional debug logging
    useEffect(() => {
        logInfo('Main component rendered, active_tab:', active_tab);
    }, [active_tab]);

    return (
        <React.Fragment>
            <div className='main'>
                <div className='main__container'>
                    <Tabs
                        active_index={active_tab}
                        className='main__tabs'
                        onTabItemChange={onEntered}
                        onTabItemClick={handleTabChange}
                        keep_inactive_mounted_ids={['id-analysis-tool']}
                        top
                        history={window.history as { replace: (url: string) => void } & History}
                    >
                        {/* Dashboard Tab - First */}
                        <div
                            label={
                                <>
                                    <DashboardIcon />
                                    <Localize i18n_default_text='Dashboard' />
                                </>
                            }
                            id='id-dbot-dashboard'
                        >
                            <Dashboard handleTabChange={handleTabChange} />
                            <button onClick={handleOpen}>Load Bot</button>
                        </div>

                        {/* Free Bots Tab - Second */}
                        <div
                            label={
                                <>
                                    <FreeBotsIcon />
                                    <Localize i18n_default_text='Free Bots' />
                                </>
                            }
                            id='id-free-bots'
                        >
                            <div className='free-bots'>
                                <h2 className='free-bots__heading'>
                                    <Localize i18n_default_text='Free Bots' />
                                </h2>
                                <div className='free-bots__content-wrapper'>
                                    <ul className='free-bots__content'>
                                        {bots.map((bot, index) => (
                                            <li
                                                className='free-bot'
                                                key={index}
                                                onClick={() => {
                                                    handleBotClick(bot);
                                                }}
                                            >
                                                <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 6 }}>
                                                    <BotIcon />
                                                </div>
                                                <div className='free-bot__details'>
                                                    <h3 className='free-bot__title'>
                                                        {bot.title}
                                                    </h3>
                                                    <div className='free-bot__description'>
                                                        Quick-load XML
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Bot Builder Tab - Third */}
                        <div
                            label={
                                <>
                                    <BotBuilderIcon />
                                    <Localize i18n_default_text='Bot Builder' />
                                </>
                            }
                            id='id-bot-builder'
                        >
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <h2>Bot Builder</h2>
                                <p>Use the Bot Builder to create your trading strategies.</p>
                            </div>
                        </div>

                        {/* DTrader Tab - Fourth */}
                        <div
                            label={
                                <>
                                    <DTraderIcon />
                                    <Localize i18n_default_text='DTrader' />
                                </>
                            }
                            id='id-dtrader'
                        >
                            <DTraderErrorBoundary>
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading DTrader...')} />}
                                >
                                    <DTrader />
                                </Suspense>
                            </DTraderErrorBoundary>
                        </div>

                        {/* Charts Tab - Fifth */}
                        <div
                            label={
                                <>
                                    <ChartsIcon />
                                    <Localize i18n_default_text='Charts' />
                                </>
                            }
                            id='id-charts'
                        >
                            <Suspense fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}>
                                <Chart show_digits_stats={false} />
                            </Suspense>
                        </div>

                        {/* Analysis Tool Tab - Fifth */}
                        {(
                        <div
                            label={
                                <>
                                    <AnalysisToolIcon />
                                    <Localize i18n_default_text='Analysis Tool' />
                                </>
                            }
                            id='id-analysis-tool'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <Suspense fallback={<ChunkLoader message='Loading analysis tool...' />}>
                                    <AnalysistoolComponent isActive={active_tab === DBOT_TABS.ANALYSIS_TOOL} />
                                </Suspense>
                            </div>
                        </div>
                        ) as React.ReactElement}

                        {/* The rest of the tabs follow in their original order */}
                        {(
                        <div
                            label={
                                <>
                                    <TutorialsIcon />
                                    <Localize i18n_default_text='Tutorials' />
                                </>
                            }
                            id='id-tutorials'
                        >
                            <Suspense
                                fallback={<ChunkLoader message={localize('Please wait, loading tutorials...')} />}
                            >
                                <Tutorial handleTabChange={handleTabChange} />
                            </Suspense>
                        </div>
                        ) as React.ReactElement}
                        {(
                        <div
                            label={
                                <>
                                    <BulkTradingIcon />
                                    <Localize i18n_default_text='Bulk Trading' />
                                </>
                            }
                            id='id-bulk-trading'
                        >
                            <div className='bulk-trading'>
                                <h2 className='bulk-trading__heading'>
                                    <Localize i18n_default_text='Bulk Trading Bot' />
                                </h2>
                                <div className='bulk-trading__description'>
                                    <p>
                                        <Localize i18n_default_text='This pre-built bot demonstrates simultaneous contract purchases for diversified trading strategies.' />
                                    </p>
                                </div>
                                <div className='bulk-trading__content-wrapper'>
                                    <div className='bulk-trading__bot-preview'>
                                        <h3>
                                            <Localize i18n_default_text='Pre-built Bulk Trading Strategy' />
                                        </h3>
                                        <ul className='bulk-trading__features'>
                                            <li>
                                                ✅ <Localize i18n_default_text='Purchases 5 contracts simultaneously' />
                                            </li>
                                            <li>
                                                ✅{' '}
                                                <Localize i18n_default_text='Risk diversification across multiple positions' />
                                            </li>
                                            <li>
                                                ✅ <Localize i18n_default_text='Automated profit/loss management' />
                                            </li>
                                            <li>
                                                ✅{' '}
                                                <Localize i18n_default_text='Customizable contract types and amounts' />
                                            </li>
                                        </ul>
                                        <button
                                            className='bulk-trading__load-btn'
                                            onClick={() => handleBulkTradingBotClick()}
                                        >
                                            <Localize i18n_default_text='Load Bulk Trading Bot' />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ) as React.ReactElement}
                        {(
                        <div
                            label={
                                <>
                                    <CopyTradingIcon />
                                    <Localize i18n_default_text='Copy Trading' />
                                </>
                            }
                            id='id-copy-trading'
                        >
                            <div className='copy-trading'>
                                <h2 className='copy-trading__heading'>
                                    <Localize i18n_default_text='Copy Trading' />
                                </h2>
                                <div className='copy-trading__description'>
                                    <p>
                                        <Localize i18n_default_text='Automatically copy all your demo trades to your real account. Enable this feature to mirror your demo trading activity to real money.' />
                                    </p>
                                </div>
                                <div className='copy-trading__content-wrapper'>
                                    <div className='copy-trading__status'>
                                        <div className='copy-trading__account-info'>
                                            <div className='copy-trading__account'>
                                                <h3>Real Account Balance</h3>
                                                <div className='copy-trading__balance'>
                                                    <span className='copy-trading__balance-label'>Balance:</span>
                                                    <span className='copy-trading__balance-amount'>
                                                        {isLoadingBalance
                                                            ? 'Loading...'
                                                            : `$${realAccountBalance.toFixed(2)}`}
                                                    </span>
                                                    <button
                                                        onClick={fetchRealAccountBalance}
                                                        className='copy-trading__refresh-btn'
                                                        disabled={isLoadingBalance}
                                                        style={{
                                                            marginLeft: '10px',
                                                            padding: '4px 8px',
                                                            fontSize: '12px',
                                                            background: '#4CAF50',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: isLoadingBalance ? 'not-allowed' : 'pointer',
                                                        }}
                                                    >
                                                        {isLoadingBalance ? '...' : 'Refresh'}
                                                    </button>
                                                </div>
                                                <div className='copy-trading__status-indicator'>
                                                    <span
                                                        className={`copy-trading__status-dot ${realAccountBalance > 0 ? 'real' : 'inactive'}`}
                                                    ></span>
                                                    <span>{realAccountBalance > 0 ? 'Active' : 'Inactive'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='copy-trading__controls'>
                                            <div className='copy-trading__toggle'>
                                                <label className='copy-trading__toggle-label'>
                                                    <input
                                                        type='checkbox'
                                                        checked={copyTradingEnabled}
                                                        onChange={handleCopyTradingToggle}
                                                        disabled={realAccountBalance === 0}
                                                    />
                                                    <span className='copy-trading__toggle-slider'></span>
                                                    <span className='copy-trading__toggle-text'>
                                                        {copyTradingEnabled ? 'Copy Trading ON' : 'Copy Trading OFF'}
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className='copy-trading__info'>
                                            <h4>How Copy Trading Works:</h4>
                                            <ul>
                                                <li>✅ Trade on your demo account as usual in the Bot Builder</li>
                                                <li>
                                                    ✅ When copy trading is enabled, identical trades are automatically
                                                    placed on your real account
                                                </li>
                                                <li>
                                                    ✅ Real account trades use the same parameters (symbol, amount,
                                                    duration, etc.)
                                                </li>
                                                <li>
                                                    ✅ You can disable copy trading anytime to stop mirroring trades
                                                </li>
                                                <li>✅ Only works when you have a real account balance</li>
                                                <li>
                                                    ✅ Your real account balance is fetched automatically from Deriv
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ) as React.ReactElement}
                        {(
                        <div
                            label={
                                <>
                                    <SignalsIcon />
                                    <Localize i18n_default_text='Signals' />
                                </>
                            }
                            id='id-signals'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <iframe
                                    src='signals'
                                    width='100%'
                                    height='600px'
                                    style={{ border: 'none', display: 'block' }}
                                    title='Signals'
                                    scrolling='yes'
                                />
                            </div>
                        </div>
                        ) as React.ReactElement}
                        {(
                        <div
                            label={
                                <>
                                    <TradingHubIcon />
                                    <Localize i18n_default_text='Trading Hub' />
                                </>
                            }
                            id='id-Trading-Hub'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <iframe
                                    src='https://mekop.netlify.app'
                                    height='600px'
                                    frameBorder='0'
                                    title='Trading Hub'
                                />
                            </div>
                        </div>
                        ) as React.ReactElement}
                    </Tabs>
                </div>
            </div>
            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    <RunStrategy />
                    {showRunPanel ? <RunPanel /> : <div />}
                </div>
                <ChartModal />
                <TradingViewModal />
            </DesktopWrapper>
            <MobileWrapper>
                <RunPanel />
            </MobileWrapper>
            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick ?? (() => {})}
                onClose={onCloseDialog ?? (() => {})}
                onConfirm={onOkButtonClick ?? (() => {})}
                title={title}
            >
                {message}
            </Dialog>
        </React.Fragment>
    );
});

const Main = AppWrapper;
export default Main;
