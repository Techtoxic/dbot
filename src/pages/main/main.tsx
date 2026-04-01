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
    <svg width='20' height='20' fill='var(--text-general)' viewBox='0 0 24 24'>
        <path d='M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' />
    </svg>
);

const BotBuilderIcon = () => (
    <svg fill='var(--text-general)' width='24px' height='24px' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
        <path
            fillRule='evenodd'
            d='M20,9.85714286 L20,14.1428571 C20,15.2056811 19.0732946,16 18,16 L6,16 C4.92670537,16 4,15.2056811 4,14.1428571 L4,9.85714286 C4,8.79431889 4.92670537,8 6,8 L18,8 C19.0732946,8 20,8.79431889 20,9.85714286 Z M6,10 L6,14 L18,14 L18,10 L6,10 Z M2,19 L2,17 L22,17 L22,19 L2,19 Z M2,7 L2,5 L22,5 L22,7 L2,7 Z'
        />
    </svg>
);

const ChartsIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M21 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V3M6 15L10 11L14 15L20 9M20 9V13M20 9H16'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const TutorialsIcon = () => (
    <svg width='24px' height='24px' viewBox='0 0 192 192' xmlns='http://www.w3.org/2000/svg' fill='none'>
        <path
            stroke='var(--text-general)'
            strokeWidth='12'
            d='M170 96c0-45-4.962-49.999-50-50H72c-45.038.001-50 5-50 50s4.962 49.999 50 50h48c45.038-.001 50-5 50-50Z'
        />
        <path
            stroke='var(--text-general)'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='12'
            d='m82 74 34 22-34 22'
        />
    </svg>
);

const AnalysisToolIcon = () => (
    <svg width='24px' height='24px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M7.5 3.5V6.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path d='M7.5 14.5V18.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path
            d='M6.8 6.5C6.08203 6.5 5.5 7.08203 5.5 7.8V13.2C5.5 13.918 6.08203 14.5 6.8 14.5H8.2C8.91797 14.5 9.5 13.918 9.5 13.2V7.8C9.5 7.08203 8.91797 6.5 8.2 6.5H6.8Z'
            stroke='var(--text-general)'
        />
        <path d='M16.5 6.5V11.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path d='M16.5 16.5V20.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path
            d='M15.8 11.5C15.082 11.5 14.5 12.082 14.5 12.8V15.2C14.5 15.918 15.082 16.5 15.8 16.5H17.2C17.918 16.5 18.5 15.918 18.5 15.2V12.8C18.5 12.082 17.918 11.5 17.2 11.5H15.8Z'
            stroke='var(--text-general)'
        />
    </svg>
);

const SignalsIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M8 6.00067L21 6.00139M8 12.0007L21 12.0015M8 18.0007L21 18.0015M3.5 6H3.51M3.5 12H3.51M3.5 18H3.51M4 6C4 6.27614 3.77614 6.5 3.5 6.5C3.22386 6.5 3 6.27614 3 6C3 5.72386 3.22386 5.5 3.5 5.5C3.77614 5.5 4 5.72386 4 6ZM4 12C4 12.2761 3.77614 12.5 3.5 12.5C3.22386 12.5 3 12.2761 3 12C3 11.7239 3.22386 11.5 3.5 11.5C3.77614 11.5 4 11.7239 4 12ZM4 18C4 18.2761 3.77614 18.5 3.5 18.5C3.22386 18.5 3 18.2761 3 18C3 17.7239 3.22386 17.5 3.5 17.5C3.77614 17.5 4 17.7239 4 18Z'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const TradingHubIcon = () => (
    <svg xmlns='http://www.w3.org/2000/svg' fill='var(--text-general)' width='24px' height='24px' viewBox='0 0 24 24'>
        <path d='M21.49 13.926l-3.273 2.48c.054-.663.116-1.435.143-2.275.04-.89.023-1.854-.043-2.835-.043-.487-.097-.98-.184-1.467-.077-.485-.196-.982-.31-1.39-.238-.862-.535-1.68-.9-2.35-.352-.673-.786-1.173-1.12-1.462-.172-.144-.31-.248-.414-.306l-.153-.093c-.083-.05-.187-.056-.275-.003-.13.08-.175.252-.1.388l.01.02s.11.198.258.54c.07.176.155.38.223.63.08.24.14.528.206.838.063.313.114.66.17 1.03l.15 1.188c.055.44.106.826.13 1.246.03.416.033.85.026 1.285.004.872-.063 1.76-.115 2.602-.062.853-.12 1.65-.172 2.335 0 .04-.004.073-.005.11l-.115-.118-2.996-3.028-1.6.454 5.566 6.66 6.394-5.803-1.503-.677z' />
        <path d='M2.503 9.48L5.775 7c-.054.664-.116 1.435-.143 2.276-.04.89-.023 1.855.043 2.835.043.49.097.98.184 1.47.076.484.195.98.31 1.388.237.862.534 1.68.9 2.35.35.674.785 1.174 1.12 1.463.17.145.31.25.413.307.1.06.152.093.152.093.083.05.187.055.275.003.13-.08.175-.252.1-.388l-.01-.02s-.11-.2-.258-.54c-.07-.177-.155-.38-.223-.63-.082-.242-.14-.528-.207-.84-.064-.312-.115-.658-.172-1.027-.046-.378-.096-.777-.15-1.19-.053-.44-.104-.825-.128-1.246-.03-.415-.033-.85-.026-1.285-.004-.872.063-1.76.115-2.603.064-.853.122-1.65.174-2.334 0-.04.004-.074.005-.11l.114.118 2.996 3.027 1.6-.454L7.394 3 1 8.804l1.503.678z' />
    </svg>
);

const FreeBotsIcon = () => (
    <svg
        fill='var(--text-general)'
        width='20px'
        height='20px'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
        data-name='Layer 1'
    >
        <path d='M10,13H4a1,1,0,0,0-1,1v6a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V14A1,1,0,0,0,10,13ZM9,19H5V15H9ZM20,3H14a1,1,0,0,0-1,1v6a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V4A1,1,0,0,0,20,3ZM19,9H15V5h4Zm1,7H18V14a1,1,0,0,0-2,0v2H14a1,1,0,0,0,0,2h2v2a1,1,0,0,0,2,0V18h2a1,1,0,0,0,0-2ZM10,3H4A1,1,0,0,0,3,4v6a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V4A1,1,0,0,0,10,3ZM9,9H5V5H9Z' />
    </svg>
);

const BulkTradingIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M3 7H21L19 2H5L3 7Z'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M3 7L5 22H19L21 7'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path d='M9 11V15' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
        <path d='M15 11V15' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
        <path d='M12 9V17' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
    </svg>
);

const CopyTradingIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z'
            fill='var(--text-general)'
        />
        <path d='M12 9H18V11H12V9ZM12 13H18V15H12V13ZM12 17H15V19H12V17Z' fill='var(--text-general)' />
    </svg>
);

const BotIcon = () => (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z'
            fill='var(--text-general)'
        />
    </svg>
);

const DTraderIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M3 3V21H21V19H5V3H3Z'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M7 16L12 11L16 15L21 10'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M17 10H21V14'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
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
    const { dashboard, load_modal, run_panel, summary_card } = useStore();
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
            const { client } = useStore();
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
    }, []);

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
            const { client } = useStore();
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
                                <div
                                    className='free-bots__content-wrapper'
                                    style={{ maxWidth: '1100px', margin: '0 auto' }}
                                >
                                    <ul
                                        className='free-bots__content'
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            alignItems: 'stretch',
                                            gap: '14px',
                                            listStyle: 'none',
                                            padding: 0,
                                            margin: 0,
                                        }}
                                    >
                                        {bots.map((bot, index) => (
                                            <li
                                                className='free-bot'
                                                key={index}
                                                onClick={() => {
                                                    handleBotClick(bot);
                                                }}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e6e9e9',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    cursor: 'pointer',
                                                    background: '#fff',
                                                    width: 'clamp(200px, 30vw, 260px)',
                                                    minHeight: '68px',
                                                    boxShadow: '0 1px 2px rgb(0 0 0 / 6%)',
                                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                                }}
                                            >
                                                <div style={{ width: 34, height: 34, flexShrink: 0 }}>
                                                    <BotIcon />
                                                </div>
                                                <div
                                                    className='free-bot__details'
                                                    style={{ overflow: 'hidden', flex: 1 }}
                                                >
                                                    <h3
                                                        className='free-bot__title'
                                                        style={{
                                                            fontSize: '1rem',
                                                            margin: 0,
                                                            whiteSpace: 'nowrap',
                                                            textOverflow: 'ellipsis',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        {bot.title}
                                                    </h3>
                                                    <div
                                                        style={{
                                                            fontSize: '0.78rem',
                                                            color: '#666',
                                                            marginTop: 4,
                                                            whiteSpace: 'nowrap',
                                                            textOverflow: 'ellipsis',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
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
