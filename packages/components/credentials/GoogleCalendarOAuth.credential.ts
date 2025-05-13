import { INodeParams, INodeCredential } from '../src/Interface'
import { OAuth2Client } from 'google-auth-library'

class GoogleCalendarOAuth implements INodeCredential {
    label: string
    name: string
    version: number
    inputs: INodeParams[]

    constructor() {
        this.label = 'Google Calendar OAuth'
        this.name = 'googleCalendarOAuth'
        this.version = 1.0
        this.inputs = [
            {
                label: 'Client ID',
                name: 'clientId',
                type: 'string',
                description: 'OAuth Client ID from Google Cloud Console',
                placeholder: 'your-client-id.apps.googleusercontent.com'
            },
            {
                label: 'Client Secret',
                name: 'clientSecret',
                type: 'string',
                description: 'OAuth Client Secret from Google Cloud Console'
            },
            {
                label: 'Redirect URI',
                name: 'redirectUri',
                type: 'string',
                description: 'OAuth Redirect URI (must match one registered in Google Cloud Console)',
                placeholder: 'http://localhost:8118/api/v1/oauth/callback/calendar',
                default: 'http://localhost:8118/api/v1/oauth/callback/calendar'
            },
            {
                label: 'Authenticate Calendar',
                name: 'authenticate',
                type: 'button',
                buttonText: '🔑 Start Calendar Authentication',
                description: 'Click to authorize your Google Calendar account after setting Client ID and Secret'
            },
            {
                label: 'Authentication Status',
                name: 'authStatus',
                type: 'options',
                options: [
                    {
                        label: '⚠️ Not Authenticated',
                        name: 'notAuthenticated',
                        description: 'Google Calendar account not connected'
                    },
                    {
                        label: '✅ Authenticated',
                        name: 'authenticated',
                        description: 'Google Calendar account connected successfully'
                    }
                ],
                default: 'notAuthenticated',
                description: 'Shows current authentication status',
                readonly: true
            },
            {
                label: 'Access Token',
                name: 'accessToken',
                type: 'string',
                description: 'OAuth Access Token (populated automatically after authentication)',
                optional: true,
                readonly: true
            },
            {
                label: 'Refresh Token',
                name: 'refreshToken',
                type: 'string',
                description: 'OAuth Refresh Token (populated automatically after authentication)',
                optional: true,
                readonly: true
            },
            {
                label: 'Token Expiry',
                name: 'tokenExpiry',
                type: 'string',
                description: 'Token expiry date (populated automatically after authentication)',
                optional: true,
                readonly: true
            }
        ]
    }

    /**
     * Start OAuth flow for Google Calendar
     */
    async startAuth(credential: Record<string, any>, options: Record<string, any>): Promise<{authUrl: string}> {
        try {
            console.log('=== GOOGLE CALENDAR AUTH DEBUG ===')
            console.log('Starting Google Calendar OAuth flow with options:', JSON.stringify(options))
            console.log('Credential data:', JSON.stringify({
                clientId: credential.clientId ? credential.clientId.substring(0, 15) + '...' : undefined,
                redirectUri: credential.redirectUri,
                hasClientSecret: typeof credential.clientSecret === 'string' && credential.clientSecret.length > 0,
                clientSecretType: typeof credential.clientSecret
            }))

            const { clientId, clientSecret, redirectUri } = credential

            // Additional validation with better error messages
            if (!clientId || clientId.trim() === '') {
                console.error('Missing Client ID for Google Calendar API authentication')
                throw new Error('Missing Client ID for Google Calendar API authentication. Please provide a valid Client ID.')
            }

            if (!clientSecret || clientSecret.trim() === '') {
                console.error('Missing Client Secret for Google Calendar API authentication')
                throw new Error('Missing Client Secret for Google Calendar API authentication. Please provide a valid Client Secret.')
            }

            const defaultRedirectUri = 'http://localhost:3033/api/v1/oauth/callback/calendar'
            const finalRedirectUri = redirectUri || defaultRedirectUri

            console.log(`Using redirectUri: ${finalRedirectUri}`)

            // Create state parameter with credential info and auth data for 'new' credentials
            const stateData: {
                credentialId: string;
                credentialData?: {
                    clientId: string;
                    clientSecret: string;
                    redirectUri: string;
                };
            } = {
                credentialId: options.credentialId || 'new'
            };
            
            // For new credentials, include the credential data in the state
            if (!options.credentialId || options.credentialId === 'new') {
                stateData.credentialData = {
                    clientId,
                    clientSecret,
                    redirectUri: finalRedirectUri
                };
            }
            
            const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

            // Create OAuth2 client
            const oAuth2Client = new OAuth2Client({
                clientId,
                clientSecret,
                redirectUri: finalRedirectUri
            })

            // Define scopes for Google Calendar API access
            const scopes = [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events',
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/calendar.settings.readonly'
            ]

            // Generate authentication URL
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent',
                state
            })

            console.log('Authentication URL generated successfully:', authUrl.substring(0, 60) + '...')
            return { authUrl }
        } catch (error) {
            console.error('Error generating Google Calendar auth URL:', error)
            // Provide more detailed error to user
            if (error.message && error.message.includes('invalid_client')) {
                throw new Error('Invalid client credentials. Please verify your Client ID and Client Secret are correct.')
            } else if (error.message && error.message.includes('redirect_uri_mismatch')) {
                throw new Error('Redirect URI mismatch. Please ensure the redirect URI matches one configured in Google Cloud Console.')
            } else {
                throw new Error(`Failed to generate Google Calendar authentication URL: ${error.message}`)
            }
        }
    }
}

module.exports = { credClass: GoogleCalendarOAuth }