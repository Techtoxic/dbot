import { useDevice } from '@deriv-com/ui';
import './app-logo.scss';

export const AppLogo = () => {
    const { isDesktop } = useDevice();

    return (
        <a href='https://scofieldtrades.site' target='_blank' rel='noopener noreferrer' className='app-header__logo'>
            <div className={isDesktop ? 'calebtrading-hub-logo' : 'calebtrading-hub-logo-mobile'}>
                <div className={isDesktop ? 'logo-icon' : 'logo-icon-mobile'}>CT</div>
                {isDesktop && (
                    <div className='logo-text'>
                        <span className='logo-main'>CALEBTRADING</span>
                        <span className='logo-sub'>HUB</span>
                    </div>
                )}
                {!isDesktop && (
                    <div className='logo-text-mobile'>
                        <span className='logo-main-mobile'>CALEB</span>
                    </div>
                )}
            </div>
        </a>
    );
};
