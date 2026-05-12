import React from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import useIsTNCNeeded from '@/hooks/useIsTNCNeeded';
import { useStore } from '@/hooks/useStore';
import { Button, Link, Text } from '@deriv-com/quill-ui';
import { Localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import Modal from '../shared_ui/modal';
import './tnc-status-update-modal.scss';

const TncStatusUpdateModal: React.FC = observer(() => {
    const { client } = useStore();
    const { is_cr_account, loginid } = client;
    const [is_tnc_open, setIsTncOpen] = React.useState(false);
    const [is_submitting, setIsSubmitting] = React.useState(false);
    const [is_tnc_acknowledged, setIsTncAcknowledged] = React.useState(false);
    const { isDesktop } = useDevice();
    const is_tnc_needed = useIsTNCNeeded();
    const tncSuppressionKey = React.useMemo(() => `tnc_approval_suppressed_${loginid || 'unknown'}`, [loginid]);

    React.useEffect(() => {
        const is_tnc_suppressed = localStorage.getItem(tncSuppressionKey) === '1';

        if (is_tnc_suppressed) {
            setIsTncAcknowledged(true);
            setIsTncOpen(false);
            return;
        }

        if (is_tnc_needed && !is_tnc_acknowledged) {
            setIsTncOpen(true);
        } else if (!is_tnc_needed) {
            setIsTncOpen(false);
        }
    }, [is_tnc_acknowledged, is_tnc_needed, tncSuppressionKey]);

    React.useEffect(() => {
        setIsTncAcknowledged(false);
    }, [loginid]);

    const sendTncApproval = async (): Promise<{ error?: { code?: string; message?: string } }> => {
        const connection = api_base.api?.connection as WebSocket | undefined;

        if (!connection || connection.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket connection is not ready');
        }

        const req_id = Date.now();

        return new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                cleanup();
                reject(new Error('T&C approval request timed out'));
            }, 10000);

            const cleanup = () => {
                window.clearTimeout(timeout);
                connection.removeEventListener('message', onMessage);
                connection.removeEventListener('error', onError);
            };

            const onError = () => {
                cleanup();
                reject(new Error('WebSocket error while submitting T&C approval'));
            };

            const onMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data) as {
                        req_id?: number;
                        msg_type?: string;
                        error?: { code?: string; message?: string };
                    };

                    if (data.req_id !== req_id || data.msg_type !== 'tnc_approval') return;

                    cleanup();
                    resolve(data);
                } catch {
                    // Ignore unrelated/non-JSON socket payloads.
                }
            };

            connection.addEventListener('message', onMessage);
            connection.addEventListener('error', onError);
            connection.send(JSON.stringify({ tnc_approval: 1, req_id }));
        });
    };

    const onClick = async () => {
        if (is_submitting) return;

        setIsSubmitting(true);

        try {
            const active_loginid = localStorage.getItem('active_loginid') ?? '';
            const accounts_list = JSON.parse(localStorage.getItem('accountsList') ?? '{}') as Record<string, string>;
            const active_token = active_loginid ? accounts_list[active_loginid] : '';

            if (active_token && localStorage.getItem('authToken') !== active_token) {
                localStorage.setItem('authToken', active_token);
                await api_base.init(true);
            }

            if (!api_base.api) {
                await api_base.init();
            }

            if (!api_base.api) return;

            let approval_response = await sendTncApproval();

            if (
                approval_response?.error?.code === 'InvalidToken' ||
                approval_response?.error?.code === 'AuthorizationRequired'
            ) {
                await api_base.init(true);
                approval_response = await sendTncApproval();
            }

            if (approval_response?.error) {
                throw approval_response.error;
            }

            setIsTncAcknowledged(true);
            setIsTncOpen(false);

            try {
                const settings_response = await api_base.api.getSettings();
                client.setAccountSettings(settings_response.get_settings);
            } catch (settings_error) {
                console.warn('T&C approved but failed to refresh settings', settings_error);
            }
        } catch (error: unknown) {
            const api_error = error as { code?: string; message?: string };

            if (api_error?.code === 'PermissionDenied') {
                // If the OAuth app cannot grant admin scope, avoid trapping user in a modal loop.
                localStorage.setItem(tncSuppressionKey, '1');
                setIsTncAcknowledged(true);
                setIsTncOpen(false);
            }

            console.error('Failed to submit T&C approval', {
                code: api_error?.code,
                message: api_error?.message,
                raw: error,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const tncLink = is_cr_account
        ? 'https://deriv.com/eu/terms-and-conditions#clients'
        : 'https://deriv.com/terms-and-conditions#clients';

    return (
        <Modal className='tnc-status-update-modal-wrapper' is_open={is_tnc_open} has_close_icon={false} width='44rem'>
            <div className='tnc-status-update-modal'>
                <Text size={isDesktop ? 'sm' : 'md'} bold>
                    <Localize i18n_default_text="Updated T&C's" />
                </Text>
                <div className='tnc-status-update-modal__text-container'>
                    <Text size={isDesktop ? 'sm' : 'md'}>
                        <Localize
                            i18n_default_text='Please review our updated <0>terms and conditions</0>.'
                            components={[
                                <Link className='tnc-link' key={0} size={isDesktop ? 'sm' : 'md'} href={tncLink} />,
                            ]}
                        />
                    </Text>
                    <Text size={isDesktop ? 'sm' : 'md'}>
                        <Localize i18n_default_text='By continuing you understand and accept the changes.' />
                    </Text>
                </div>
                <div className='tnc-status-update-modal__button'>
                    <Button
                        onClick={onClick}
                        size='md'
                        variant='primary'
                        disabled={is_submitting}
                        label={<Localize i18n_default_text='Continue' />}
                    />
                </div>
            </div>
        </Modal>
    );
});

export default TncStatusUpdateModal;
