import { ComponentProps } from 'react';
import { LegacyMenuHamburger1pxIcon } from '@deriv/quill-icons/Legacy';

type TToggleButton = {
    onClick: ComponentProps<'button'>['onClick'];
};

const ToggleButton = ({ onClick }: TToggleButton) => (
    <button className='mobile-menu__toggle-button' onClick={onClick}>
        <LegacyMenuHamburger1pxIcon iconSize='xs' fill='var(--text-general)' />
        <span className='mobile-menu__toggle-text'>CALEBTRADING HUB</span>
    </button>
);

export default ToggleButton;
