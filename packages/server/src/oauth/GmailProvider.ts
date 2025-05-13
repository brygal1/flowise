import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { IOAuthProvider } from '../interfaces/IOAuthProvider'
import { INodeData } from '../Interface'
import { ICommonObject } from 'flowise-components'
import { getCredentialData, getCredentialParam } from '../utils/oauthUtils'

/**
 * Gmail OAuth Provider
 */
export class GmailProvider implements IOAuthProvider {
    providerKey = 'gmail'
    displayName = 'Gmail'
    credentialType = 'gmailOAuth'
    
    // Define required scopes for Gmail
    scopes = [
        'https://mail.google.com/',                      // Full access
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/gmail.settings.basic'
    ]

    /**
     * Generate an OAuth authorization URL for Gmail
     */
    async startOAuth(nodeData: INodeData, options: ICommonObject): Promise<{ authUrl: string }> {
        try {
            console.log('Starting Gmail OAuth process...')
            
            // Get credential data
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const clientId = getCredentialParam('clientId', credentialData, nodeData, options)
            const clientSecret = getCredentialParam('clientSecret', credentialData, nodeData, options)
            const redirectUri = getCredentialParam('redirectUri', credentialData, nodeData, options)

            if (!clientId || !clientSecret || !redirectUri) {
                throw new Error('Missing required credentials for Gmail API. Please configure the OAuth credentials first.')
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

            console.log('Gmail authentication URL generated successfully')
            return { authUrl }
        } catch (error) {
            console.error('Error generating Gmail auth URL:', error)
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
            const gmail = google.gmail({ version: 'v1', auth: oAuth2Client as any })

            // Try to get user profile as a simple test
            const profile = await gmail.users.getProfile({ userId: 'me' })

            // Update authentication status
            if (nodeData.inputs) {
                nodeData.inputs.authStatus = 'authenticated'
            }

            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: tokens.expiry_date,
                authenticated: true,
                email: profile.data.emailAddress,
                message: `Successfully authenticated Gmail account: ${profile.data.emailAddress}`
            }
        } catch (error) {
            console.error('Error validating Gmail credentials:', error)

            // Update authentication status
            if (nodeData.inputs) {
                nodeData.inputs.authStatus = 'notAuthenticated'
            }

            return {
                error: 'Authentication failed: Unable to access Gmail with provided credentials',
                authenticated: false,
                message: 'Failed to authenticate Gmail account. Please try again.'
            }
        }
    }
}

// Create and export the singleton instance
export const gmailProvider = new GmailProvider()