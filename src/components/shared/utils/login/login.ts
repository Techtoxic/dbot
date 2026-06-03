import { generateOAuthURL } from '../config/config';

export const redirectToLogin = async () => {
    const oauthUrl = await generateOAuthURL();
    if (oauthUrl) {
        window.location.href = oauthUrl;
    }
};
