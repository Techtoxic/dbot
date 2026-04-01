import React, { useState } from 'react';

interface Position {
    id: string;
    contract_type: string;
    symbol: string;
    buy_price: number;
    current_spot?: number;
    payout: number;
    profit_loss: number;
    status: 'open' | 'won' | 'lost';
    entry_time: string;
    exit_time?: string;
    barrier?: string;
    barrier2?: string;
}

// Mock positions data - in real app this would come from API/store
const MOCK_POSITIONS: Position[] = [
    {
        id: '1',
        contract_type: 'CALL',
        symbol: 'R_10',
        buy_price: 10,
        current_spot: 1234.56,
        payout: 18.5,
        profit_loss: 8.5,
        status: 'open',
        entry_time: '2024-01-15 10:30:00',
    },
    {
        id: '2',
        contract_type: 'PUT',
        symbol: 'R_25',
        buy_price: 5,
        payout: 9.25,
        profit_loss: 4.25,
        status: 'won',
        entry_time: '2024-01-15 10:25:00',
        exit_time: '2024-01-15 10:30:00',
    },
    {
        id: '3',
        contract_type: 'TOUCH',
        symbol: 'frxEURUSD',
        buy_price: 15,
        payout: 0,
        profit_loss: -15,
        status: 'lost',
        entry_time: '2024-01-15 10:20:00',
        exit_time: '2024-01-15 10:25:00',
        barrier: '1.0850',
    },
];

const PositionsPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
    const [positions] = useState<Position[]>(MOCK_POSITIONS);

    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status !== 'open');

    const formatTime = (timeString: string) => {
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const formatCurrency = (amount: number) => {
        return `$${amount.toFixed(2)}`;
    };

    const getContractTypeLabel = (type: string) => {
        const labels: { [key: string]: string } = {
            CALL: 'Rise',
            PUT: 'Fall',
            TOUCH: 'Touch',
            NOTOUCH: 'No Touch',
            RANGE: 'Stays Between',
            UPORDOWN: 'Goes Outside',
        };
        return labels[type] || type;
    };

    const renderPosition = (position: Position) => (
        <div key={position.id} className='positions-panel__position'>
            <div className='positions-panel__position-header'>
                <div className='positions-panel__position-info'>
                    <span className='positions-panel__symbol'>{position.symbol}</span>
                    <span className='positions-panel__contract-type'>
                        {getContractTypeLabel(position.contract_type)}
                    </span>
                    <span className={`positions-panel__status positions-panel__status--${position.status}`}>
                        {position.status.toUpperCase()}
                    </span>
                </div>
                <div className='positions-panel__position-time'>{formatTime(position.entry_time)}</div>
            </div>

            <div className='positions-panel__position-details'>
                <div className='positions-panel__detail-row'>
                    <span>Buy Price:</span>
                    <span>{formatCurrency(position.buy_price)}</span>
                </div>

                {position.current_spot && (
                    <div className='positions-panel__detail-row'>
                        <span>Current Spot:</span>
                        <span>{position.current_spot.toFixed(5)}</span>
                    </div>
                )}

                <div className='positions-panel__detail-row'>
                    <span>Payout:</span>
                    <span>{formatCurrency(position.payout)}</span>
                </div>

                <div className='positions-panel__detail-row'>
                    <span>P&L:</span>
                    <span className={`positions-panel__pnl ${position.profit_loss >= 0 ? 'profit' : 'loss'}`}>
                        {position.profit_loss >= 0 ? '+' : ''}
                        {formatCurrency(position.profit_loss)}
                    </span>
                </div>

                {position.barrier && (
                    <div className='positions-panel__detail-row'>
                        <span>Barrier:</span>
                        <span>{position.barrier}</span>
                    </div>
                )}

                {position.barrier2 && (
                    <div className='positions-panel__detail-row'>
                        <span>Barrier 2:</span>
                        <span>{position.barrier2}</span>
                    </div>
                )}

                {position.exit_time && (
                    <div className='positions-panel__detail-row'>
                        <span>Exit Time:</span>
                        <span>{formatTime(position.exit_time)}</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className='positions-panel'>
            <div className='positions-panel__header'>
                <div className='positions-panel__tabs'>
                    <button
                        className={`positions-panel__tab ${activeTab === 'open' ? 'active' : ''}`}
                        onClick={() => setActiveTab('open')}
                    >
                        Open Positions ({openPositions.length})
                    </button>
                    <button
                        className={`positions-panel__tab ${activeTab === 'closed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('closed')}
                    >
                        Closed Positions ({closedPositions.length})
                    </button>
                </div>
            </div>

            <div className='positions-panel__content'>
                {activeTab === 'open' && (
                    <div className='positions-panel__positions'>
                        {openPositions.length > 0 ? (
                            openPositions.map(renderPosition)
                        ) : (
                            <div className='positions-panel__empty'>
                                <p>No open positions</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'closed' && (
                    <div className='positions-panel__positions'>
                        {closedPositions.length > 0 ? (
                            closedPositions.map(renderPosition)
                        ) : (
                            <div className='positions-panel__empty'>
                                <p>No closed positions</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PositionsPanel;
