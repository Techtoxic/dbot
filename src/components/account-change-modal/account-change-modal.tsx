import React from 'react';

type TAccountChangeModalProps = {
    isOpen: boolean;
    onReload: () => void;
    onClose: () => void;
};

const AccountChangeModal: React.FC<TAccountChangeModalProps> = ({ isOpen, onReload, onClose }) => {
    const handleClose = () => {
        onClose();
        onReload();
    };

    const handleReload = () => {
        onReload();
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '24px',
                    maxWidth: '400px',
                    width: '90%',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <p style={{ margin: '0 0 24px 0', color: '#333', fontSize: '14px', lineHeight: '1.5' }}>
                    Your account has changed in another tab. Reloading will switch to the new account and stop the running bot in this tab.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={handleReload}
                        style={{
                            padding: '12px 32px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#ff444f',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                    >
                        Reload
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountChangeModal;
