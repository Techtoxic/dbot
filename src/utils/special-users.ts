// Special users configuration for trial accounts
// These login IDs should be treated as trial accounts for marketing purposes
// They will show USD icons and USD account information without sending data to server

const TRIAL_ACCOUNT_LOGIN_IDS = [
    'VRTC7579953',
    
];

/**
 * Check if a login ID belongs to a special trial account
 * @param loginId - The login ID to check
 * @returns true if the login ID is a trial account
 */
export const isSpecialUser = (loginId?: string | null): boolean => {
    if (!loginId) return false;
    return TRIAL_ACCOUNT_LOGIN_IDS.includes(loginId);
};

/**
 * Check if the current account should be treated as a trial account
 * @param loginId - The login ID to check
 * @returns true if should be treated as trial account
 */
export const isTrialAccount = (loginId?: string | null): boolean => {
    if (!loginId) return false;
    return TRIAL_ACCOUNT_LOGIN_IDS.includes(loginId);
};

/**
 * Get the display currency for trial accounts (always USD for marketing)
 * @param loginId - The login ID to check
 * @param originalCurrency - The original currency from the account
 * @returns 'USD' for trial accounts, original currency otherwise
 */
export const getDisplayCurrency = (loginId?: string | null, originalCurrency?: string): string => {
    if (isTrialAccount(loginId)) {
        return 'USD';
    }
    return originalCurrency || 'USD';
};

/**
 * Get the display account type for trial accounts
 * @param loginId - The login ID to check
 * @param isVirtual - Whether the account is virtual/demo
 * @returns 'real' for trial accounts, original type otherwise
 */
export const getDisplayAccountType = (loginId?: string | null, isVirtual?: boolean): 'real' | 'virtual' => {
    if (isTrialAccount(loginId)) {
        return 'real'; // Show as real account for marketing
    }
    return isVirtual ? 'virtual' : 'real';
};

// Default export for better module resolution
export default {
    isTrialAccount,
    isSpecialUser,
    getDisplayCurrency,
    getDisplayAccountType
};
