export const redirectToLogin = () => {
    const APP_ID = '97842';
    const redirectUri = window.location.origin;
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = oauthUrl;
};
