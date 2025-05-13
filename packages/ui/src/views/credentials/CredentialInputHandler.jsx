import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import axios from 'axios'

// material-ui
import { Box, Typography, IconButton, Button } from '@mui/material'
import { IconArrowsMaximize, IconAlertTriangle, IconX } from '@tabler/icons-react'

// project import
import { Dropdown } from '@/ui-component/dropdown/Dropdown'
import { Input } from '@/ui-component/input/Input'
import { SwitchInput } from '@/ui-component/switch/Switch'
import { JsonEditorInput } from '@/ui-component/json/JsonEditor'
import { TooltipWithParser } from '@/ui-component/tooltip/TooltipWithParser'
import { baseURL } from '@/store/constant'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'

// ===========================|| NodeInputHandler ||=========================== //

const CredentialInputHandler = ({ inputParam, data, disabled = false, options = {} }) => {
    const customization = useSelector((state) => state.customization)
    const dispatch = useDispatch()
    const ref = useRef(null)

    const [showExpandDialog, setShowExpandDialog] = useState(false)
    const [expandDialogProps, setExpandDialogProps] = useState({})

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const onExpandDialogClicked = (value, inputParam) => {
        const dialogProp = {
            value,
            inputParam,
            disabled,
            confirmButtonName: 'Save',
            cancelButtonName: 'Cancel'
        }
        setExpandDialogProps(dialogProp)
        setShowExpandDialog(true)
    }

    const onExpandDialogSave = (newValue, inputParamName) => {
        setShowExpandDialog(false)
        data[inputParamName] = newValue
    }

    return (
        <div ref={ref}>
            {inputParam && (
                <>
                    <Box sx={{ p: 2 }}>
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <Typography>
                                {inputParam.label}
                                {!inputParam.optional && <span style={{ color: 'red' }}>&nbsp;*</span>}
                                {inputParam.description && <TooltipWithParser style={{ marginLeft: 10 }} title={inputParam.description} />}
                            </Typography>
                            <div style={{ flexGrow: 1 }}></div>
                            {inputParam.type === 'string' && inputParam.rows && (
                                <IconButton
                                    size='small'
                                    sx={{
                                        height: 25,
                                        width: 25
                                    }}
                                    title='Expand'
                                    color='primary'
                                    onClick={() => onExpandDialogClicked(data[inputParam.name] ?? inputParam.default ?? '', inputParam)}
                                >
                                    <IconArrowsMaximize />
                                </IconButton>
                            )}
                        </div>
                        {inputParam.warning && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    borderRadius: 10,
                                    background: 'rgb(254,252,191)',
                                    padding: 10,
                                    marginTop: 10,
                                    marginBottom: 10
                                }}
                            >
                                <IconAlertTriangle size={36} color='orange' />
                                <span style={{ color: 'rgb(116,66,16)', marginLeft: 10 }}>{inputParam.warning}</span>
                            </div>
                        )}

                        {inputParam.type === 'boolean' && (
                            <SwitchInput
                                disabled={disabled}
                                onChange={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? false}
                            />
                        )}
                        {(inputParam.type === 'string' || inputParam.type === 'password' || inputParam.type === 'number') && (
                            <Input
                                key={data[inputParam.name]}
                                disabled={disabled}
                                inputParam={inputParam}
                                onChange={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? ''}
                                showDialog={showExpandDialog}
                                dialogProps={expandDialogProps}
                                onDialogCancel={() => setShowExpandDialog(false)}
                                onDialogConfirm={(newValue, inputParamName) => onExpandDialogSave(newValue, inputParamName)}
                            />
                        )}
                        {inputParam.type === 'json' && (
                            <JsonEditorInput
                                disabled={disabled}
                                onChange={(newValue) => (data[inputParam.name] = newValue)}
                                value={data[inputParam.name] ?? inputParam.default ?? ''}
                                isDarkMode={customization.isDarkMode}
                            />
                        )}
                        {inputParam.type === 'button' && (
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                sx={{ mt: 1, mb: 1, fontWeight: 500 }}
                                disabled={disabled}
                                onClick={async () => {
                                    try {
                                        // Simple validation for required fields
                                        if (!data.clientId || !data.clientSecret) {
                                            enqueueSnackbar({
                                                message: 'Please provide both Client ID and Client Secret',
                                                options: {
                                                    key: new Date().getTime() + Math.random(),
                                                    variant: 'warning',
                                                    action: (key) => (
                                                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                                            <IconX />
                                                        </Button>
                                                    )
                                                }
                                            })
                                            return
                                        }

                                        const username = localStorage.getItem('username')
                                        const password = localStorage.getItem('password')

                                        // Simple credential object - no need to handle masked fields
                                        // Use the API base URL for the redirect (server port, not UI port)
                                        const apiBaseUrl = baseURL || 'http://localhost:8118';
                                        
                                        // Determine the credential type and redirect URI based on the inputParam
                                        const credentialName = inputParam.buttonText.toLowerCase().includes('gmail') ? 'gmailOAuth' : 'googleCalendarOAuth';
                                        const callbackPath = credentialName === 'gmailOAuth' ? 'gmail' : 'calendar';
                                        
                                        const credentialData = {
                                            clientId: data.clientId,
                                            clientSecret: data.clientSecret,
                                            redirectUri: data.redirectUri || `${apiBaseUrl}/api/v1/oauth/callback/${callbackPath}`
                                        };
                                        
                                        const response = await axios.post(
                                            `${baseURL}/api/v1/oauth/start/${callbackPath}`,
                                            {
                                                credentialId: options.credentialId,
                                                credentialName,
                                                credentialData,
                                                // Create a minimal nodeData structure
                                                nodeData: {
                                                    inputs: {
                                                        clientId: data.clientId,
                                                        clientSecret: data.clientSecret,
                                                        redirectUri: data.redirectUri
                                                    }
                                                }
                                            },
                                            {
                                                auth: username && password ? { username, password } : undefined,
                                                headers: { 'Content-type': 'application/json' }
                                            }
                                        )

                                        if (response.data && response.data.authUrl) {
                                            // Open the auth URL in a new window
                                            window.open(response.data.authUrl, '_blank', 'width=800,height=600')

                                            // Show success notification
                                            enqueueSnackbar({
                                                message: 'Authentication window opened. Please complete the Google authentication process.',
                                                options: {
                                                    key: new Date().getTime() + Math.random(),
                                                    variant: 'info',
                                                    action: (key) => (
                                                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                                            <IconX />
                                                        </Button>
                                                    )
                                                }
                                            })
                                        }
                                    } catch (error) {
                                        const oauthService = inputParam.buttonText.toLowerCase().includes('gmail') ? 'Gmail' : 'Google Calendar';
                                        console.error(`Error in ${oauthService} authentication:`, error)

                                        // Get detailed error from response if available
                                        const errorMessage = error.response?.data?.message ||
                                            `Failed to start ${oauthService} authentication. Please ensure you have entered valid Client ID and Secret.`;

                                        const errorDetails = error.response?.data?.details;

                                        if (errorDetails) {
                                            console.error('Error details:', errorDetails);
                                        }

                                        // Show error notification with specific message
                                        enqueueSnackbar({
                                            message: errorMessage,
                                            options: {
                                                key: new Date().getTime() + Math.random(),
                                                variant: 'error',
                                                persist: true, // Keep error visible until dismissed
                                                action: (key) => (
                                                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                                        <IconX />
                                                    </Button>
                                                )
                                            }
                                        })
                                    }
                                }}
                            >
                                {inputParam.buttonText || "Authenticate"}
                            </Button>
                        )}
                        {inputParam.type === 'options' && (
                            inputParam.readonly ? (
                                <div
                                    style={{
                                        padding: '8px 12px',
                                        marginTop: '8px',
                                        borderRadius: '4px',
                                        backgroundColor: inputParam.name === 'authStatus' &&
                                            data[inputParam.name] === 'authenticated' ?
                                            'rgba(46, 125, 50, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                                        border: '1px solid',
                                        borderColor: inputParam.name === 'authStatus' &&
                                            data[inputParam.name] === 'authenticated' ?
                                            'rgba(46, 125, 50, 0.5)' : 'rgba(211, 47, 47, 0.5)',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {(inputParam.options || []).find(opt =>
                                        opt.name === (data[inputParam.name] || inputParam.default))?.label ||
                                        'Status Unknown'}
                                </div>
                            ) : (
                                <Dropdown
                                    disabled={disabled}
                                    name={inputParam.name}
                                    options={inputParam.options}
                                    onSelect={(newValue) => (data[inputParam.name] = newValue)}
                                    value={data[inputParam.name] ?? inputParam.default ?? 'choose an option'}
                                />
                            )
                        )}
                    </Box>
                </>
            )}
        </div>
    )
}

CredentialInputHandler.propTypes = {
    inputAnchor: PropTypes.object,
    inputParam: PropTypes.object,
    data: PropTypes.object,
    disabled: PropTypes.bool,
    options: PropTypes.object
}

export default CredentialInputHandler