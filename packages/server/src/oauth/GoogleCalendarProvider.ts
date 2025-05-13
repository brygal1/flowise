import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { IOAuthProvider } from '../interfaces/IOAuthProvider'
import { INodeData } from '../Interface'
import { ICommonObject } from 'flowise-components'
import { getCredentialData, getCredentialParam } from '../utils/oauthUtils'

/**
 * Google Calendar OAuth Provider
 */
export class GoogleCalendarProvider implements IOAuthProvider {
    providerKey = 'calendar'
    displayName = 'Google Calendar'
    credentialType = 'googleCalendarOAuth'
    
    // Define required scopes for Google Calendar
    scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.settings.readonly'
    ]

    /**
     * Generate an OAuth authorization URL for Google Calendar
     */
    async startOAuth(nodeData: INodeData, options: ICommonObject): Promise<{ authUrl: string }> {
        try {
            console.log('Starting Google Calendar OAuth process...')
            
            // Get credential data
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const clientId = getCredentialParam('clientId', credentialData, nodeData, options)
            const clientSecret = getCredentialParam('clientSecret', credentialData, nodeData, options)
            const redirectUri = getCredentialParam('redirectUri', credentialData, nodeData, options)

            if (!clientId || !clientSecret || !redirectUri) {
                throw new Error('Missing required credentials for Google Calendar API. Please configure the OAuth credentials first.')
            }

            // Create state parameter with node and credential info
            const stateData = {
                nodeId: nodeData.id,
                credentialId: nodeData.credential || 'new',
                providerKey: this.providerKey
            }
            
            if (nodeData.credential === 'new' && options.credentialData) {
                Object.assign(stateData, { credentialData: options.credentialData })
            }
            
            const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

            // Create OAuth2 client
            const oAuth2Client = new OAuth2Client({
                clientId,
                clientSecret,
                redirectUri
            })

            // Generate authentication URL
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: this.scopes,
                prompt: 'consent',
                state
            })

            console.log('Google Calendar authentication URL generated successfully')
            return { authUrl }
        } catch (error) {
            console.error('Error generating Google Calendar auth URL:', error)
            throw error
        }
    }

    /**
     * Handle the OAuth callback and verify/save credentials
     */
    async handleOAuthCallback(code: string, nodeData: INodeData, options: ICommonObject): Promise<any> {
        let clientId: string, clientSecret: string, redirectUri: string
        
        // Handle case where credential is 'new' vs. existing
        if (nodeData.credential === 'new') {
            if (!options.credentialData) {
                throw new Error('Missing credential data for new OAuth credential')
            }
            
            const credData = options.credentialData as { clientId: string, clientSecret: string, redirectUri: string }
            clientId = credData.clientId
            clientSecret = credData.clientSecret
            redirectUri = credData.redirectUri
        } else {
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            clientId = getCredentialParam('clientId', credentialData, nodeData, options)
            clientSecret = getCredentialParam('clientSecret', credentialData, nodeData, options)
            redirectUri = getCredentialParam('redirectUri', credentialData, nodeData, options)
        }

        // Create OAuth2 client
        const oAuth2Client = new OAuth2Client({
            clientId,
            clientSecret,
            redirectUri
        })

        try {
            // Exchange code for tokens
            const { tokens } = await oAuth2Client.getToken(code)

            // Test if the tokens work by making a simple request
            oAuth2Client.setCredentials(tokens)
            const calendar = google.calendar({ version: 'v3', auth: oAuth2Client as any })

            // Try to get calendar list as a simple test
            const calendarList = await calendar.calendarList.list({ maxResults: 1 })

            // Update authentication status
            if (nodeData.inputs) {
                nodeData.inputs.authStatus = 'authenticated'
            }

            // Get user email if available
            let email = 'Unknown'
            if (calendarList.data.items && calendarList.data.items.length > 0) {
                const primaryCalendar = calendarList.data.items.find(cal => cal.primary)
                if (primaryCalendar) {
                    email = primaryCalendar.id || 'Unknown'
                }
            }

            // Return tokens and email
            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: tokens.expiry_date,
                authenticated: true,
                email: email,
                message: `Successfully authenticated Google Calendar account: ${email}`
            }
        } catch (error) {
            console.error('Error validating Google Calendar credentials:', error)

            // Update authentication status
            if (nodeData.inputs) {
                nodeData.inputs.authStatus = 'notAuthenticated'
            }

            return {
                error: 'Authentication failed: Unable to access Google Calendar with provided credentials',
                authenticated: false,
                message: 'Failed to authenticate Google Calendar account. Please try again.'
            }
        }
    }
}

// Create and export the singleton instance
export const googleCalendarProvider = new GoogleCalendarProvider()