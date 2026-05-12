import { useEffect, useState } from 'react';
import { type CallbackResult, handleOAuthCallback } from '@/components/shared/utils/oauth/callback-handler';
import { api_base } from '@/external/bot-skeleton';
import Cookies from 'js-cookie';
import { Button } from '@deriv-com/ui';

const CallbackPage = () => {
    const [callbackResult, setCallbackResult] = useState<CallbackResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const processCallback = async () => {
            try {
                console.log('🔄 Processing OAuth callback...');
                console.log('🌐 Current URL:', window.location.href);
                console.log('🔍 URL Search Params:', window.location.search);
                
                const result = await handleOAuthCallback();
                setCallbackResult(result);
                
                if (result.success) {
                    await handleSuccessfulAuth(result);
                } else {
                    console.error('❌ OAuth callback failed:', result.error);
                    setIsProcessing(false);
                }
            } catch (error) {
                console.error('❌ Callback processing error:', error);
                setCallbackResult({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    flow: 'unknown'
                });
                setIsProcessing(false);
            }
        };

        processCallback();
    }, []);

    const handleSuccessfulAuth = async (result: CallbackResult) => {
        console.log('🎉 OAuth Callback Success!');
        console.log('📋 Flow type:', result.flow);
        console.log('📋 Received result:', result);

        try {
            if (result.flow === 'oauth2' && result.accessToken) {
                // Handle OAuth 2.0 flow with access token
                // Store the access token in session storage for later use
                console.log('🔄 Processing OAuth 2.0 authentication...');
                sessionStorage.setItem('auth_info', JSON.stringify({
                    access_token: result.accessToken,
                    token_type: 'bearer',
                    expires_at: Date.now() + 3600000  
                }));

                // Set login cookie for OIDC flow recognition
                const domains = ['deriv.com', 'deriv.dev', 'binary.sx', 'pages.dev', 'localhost', 'deriv.be', 'deriv.me'];
                const currentDomain = window.location.hostname.split('.').slice(-2).join('.');
                if (domains.includes(currentDomain)) {
                    Cookies.set('logged_state', 'true', {
                        expires: 30,
                        path: '/',
                        domain: currentDomain,
                        secure: true,
                    });
                }

                // Initialize websocket auth - api_base will handle account authorization
                // using the stored access_token from sessionStorage
                console.log('🔌 Initializing websocket connection...');
                
                // CRITICAL: api_base.init(true) triggers websocket connect & authorize
                // It expects auth_info in sessionStorage and will use the access_token for OIDC flow
                await api_base.init(true);
                
                console.log('✅ OAuth 2.0 authentication completed!');
                
                // Redirect to dashboard after short delay to ensure state is propagated
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);
            } else if (result.flow === 'legacy' && result.token) {
                // Handle legacy token flow (if still needed)
                console.log('🔄 Processing legacy token authentication...');
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('active_loginid', result.loginId || '');
                
                const domains = ['deriv.com', 'deriv.dev', 'binary.sx', 'pages.dev', 'localhost', 'deriv.be', 'deriv.me'];
                const currentDomain = window.location.hostname.split('.').slice(-2).join('.');
                if (domains.includes(currentDomain)) {
                    Cookies.set('logged_state', 'true', {
                        expires: 30,
                        path: '/',
                        domain: currentDomain,
                        secure: true,
                    });
                }

                await api_base.init(true);
                
                console.log('✅ Legacy token authentication completed!');
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 500);
            } else {
                throw new Error('Invalid callback result: missing accessToken or token');
            }
        } catch (error) {
            console.error('❌ Error handling successful auth:', error);
            setCallbackResult({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process authentication',
                flow: result.flow
            });
            setIsProcessing(false);
        }
    };

    if (isProcessing) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column',
                    gap: '16px'
                }}
            >
                <div
                    style={{
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f0f0f0',
                        borderTop: '4px solid #1e90ff',
                        animation: 'spin 1s linear infinite'
                    }}
                />
                <p>Processing your login...</p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (!callbackResult?.success) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column',
                    gap: '16px',
                    textAlign: 'center',
                    padding: '20px'
                }}
            >
                <p>❌ Authentication failed: {callbackResult?.error}</p>
                <Button onClick={() => (window.location.href = '/')}>
                    Return to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column',
                gap: '16px'
            }}
        >
            <p>✅ Authentication successful! Redirecting...</p>
        </div>
    );
};

export default CallbackPage;
