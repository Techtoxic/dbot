import { useDevice } from '@deriv-com/ui';
import './app-logo.scss';

export const AppLogo = () => {
    const { isDesktop } = useDevice();

    if (!isDesktop) return null;

    return (
        <a href='https://scofieldtrades.site' target='_blank' rel='noopener noreferrer' className='app-header__logo'>
            <div className='calebtrading-hub-logo'>
                <div className='logo-icon'>CT</div>
                <div className='logo-text'>
                    <span className='logo-main'>CALEBTRADING</span>
                    <span className='logo-sub'>HUB</span>
                </div>
            </div>
        </a>
    );
};
