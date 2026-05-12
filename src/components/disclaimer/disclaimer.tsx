import { useState } from 'react';
import Modal from '@/components/shared_ui/modal';
import './disclaimer.scss';

const Disclaimer = () => {
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    const disclaimerText = `
        RISK WARNING: Trading binary options and other financial instruments involves significant risk and may result in the loss of all your invested capital. You should not invest money that you cannot afford to lose. Before trading, please ensure you fully understand the risks involved and seek independent financial advice if necessary.

        This platform is for educational and entertainment purposes. Past performance does not guarantee future results. Trading involves substantial risk of loss and is not suitable for all investors.

        By using this platform, you acknowledge that you understand these risks and agree to trade at your own discretion and responsibility.
    `;

    return (
        <>
            {/* Disclaimer Button - Bottom Right */}
            <button
                className="disclaimer-button"
                onClick={() => setShowDisclaimer(true)}
                title="View Disclaimer"
            >
                Disclaimer
            </button>

            {/* Disclaimer Modal */}
            <Modal
                is_open={showDisclaimer}
                toggleModal={() => setShowDisclaimer(false)}
                title="Risk Disclaimer"
                is_vertical_centered={true}
                width="500px"
                className="disclaimer-modal"
            >
                <div className="disclaimer-content">
                    <div className="disclaimer-text">
                        {disclaimerText.trim().split('\n\n').map((paragraph, index) => (
                            <p key={index}>{paragraph.trim()}</p>
                        ))}
                    </div>
                    <button
                        className="disclaimer-understand-btn"
                        onClick={() => setShowDisclaimer(false)}
                    >
                        I Understand
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default Disclaimer;