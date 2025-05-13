import { Tool, StructuredTool } from '@langchain/core/tools'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses, getCredentialData, getCredentialParam } from '../../../src/utils'
import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { Readable } from 'stream'
import { GmailReadTool, GmailSendTool, GmailDraftTool, GmailLabelTool, GmailManageTool, createGmailClient } from './core'

class GmailAPI_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    credential: INodeParams
    inputs: INodeParams[]
    constructor() {
        this.label = 'Gmail API'
        this.name = 'gmailAPI'
        this.version = 1.0
        this.type = 'GmailAPI'
        this.icon = 'gmail.svg'
        this.category = 'Tools'
        this.description = 'Access Gmail API for email management, composition, and organization'
        this.baseClasses = [this.type, 'Tool']
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['gmailOAuth']
        }
        this.inputs = [
            {
                label: 'Actions',
                name: 'actions',
                type: 'multiOptions',
                options: [
                    {
                        label: 'Read Emails',
                        name: 'readEmails',
                        description: 'Read and search emails in Gmail'
                    },
                    {
                        label: 'Send Email',
                        name: 'sendEmail',
                        description: 'Compose and send emails'
                    },
                    {
                        label: 'Draft Email',
                        name: 'draftEmail',
                        description: 'Create and save email drafts'
                    },
                    {
                        label: 'Manage Labels',
                        name: 'manageLabels',
                        description: 'Create, list, and manage email labels'
                    },
                    {
                        label: 'Manage Emails',
                        name: 'manageEmails',
                        description: 'Archive, delete, and organize emails'
                    }
                ],
                default: ['readEmails', 'sendEmail', 'draftEmail', 'manageLabels', 'manageEmails'],
                description: 'Select the Gmail actions to enable'
            },
            {
                label: 'Max Emails to Fetch',
                name: 'maxResults',
                type: 'number',
                default: 10,
                description: 'Maximum number of emails to fetch in a single request'
            },
            {
                label: 'Authenticate Gmail',
                name: 'authenticate',
                type: 'button',
                buttonText: '🔑 Authenticate Gmail Account',
                description: 'Click to start OAuth authentication with your Gmail account'
            },
            {
                label: 'Authentication Status',
                name: 'authStatus',
                type: 'options',
                options: [
                    {
                        label: '⚠️ Not Authenticated',
                        name: 'notAuthenticated',
                        description: 'Gmail account not connected'
                    },
                    {
                        label: '✅ Authenticated',
                        name: 'authenticated',
                        description: 'Gmail account connected successfully'
                    }
                ],
                default: 'notAuthenticated',
                description: 'Shows the current authentication status. If you encounter "Insufficient Permission" errors, you need to re-authenticate with the "Authenticate Gmail Account" button to grant full access permissions.',
                additionalParams: true,
                readonly: true
            }
        ]
    }

    /**
     * Initialize the Gmail API client and create tools based on selected actions
     */
    async init(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const clientId = getCredentialParam('clientId', credentialData, nodeData)
        const clientSecret = getCredentialParam('clientSecret', credentialData, nodeData)
        const redirectUri = getCredentialParam('redirectUri', credentialData, nodeData)
        const accessToken = getCredentialParam('accessToken', credentialData, nodeData)
        const refreshToken = getCredentialParam('refreshToken', credentialData, nodeData)
        const tokenExpiry = getCredentialParam('tokenExpiry', credentialData, nodeData)

        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Missing required credentials for Gmail API')
        }

        // Update the authentication status
        const isAuthenticated = accessToken && refreshToken
        if (nodeData.inputs) {
            nodeData.inputs.authStatus = isAuthenticated ? 'authenticated' : 'notAuthenticated'
        }

        if (!isAuthenticated) {
            throw new Error('Gmail account not authenticated. Please click the Authenticate button to connect your Gmail account.')
        }

        // Create client with credentials
        const credentials = { clientId, clientSecret, redirectUri }
        const token = { accessToken, refreshToken, tokenExpiry }

        console.log('GmailAPI - Creating Gmail client with credentials and token')
        
        // Create Gmail client
        let gmail;
        try {
            gmail = await createGmailClient(credentials, token)
            console.log('GmailAPI - Gmail client created successfully')
        } catch (error) {
            console.error('GmailAPI - Error creating Gmail client:', error)
            throw error
        }

        // Get selected actions
        const actions = nodeData.inputs?.actions
        let selectedActions: string[] = []
        
        if (actions) {
            console.log('GmailAPI - Actions input type:', typeof actions, 'Value:', actions)
            
            // Handle different possible formats of the actions data
            if (Array.isArray(actions)) {
                selectedActions = actions
            } else if (typeof actions === 'string') {
                try {
                    // Try to parse as JSON if it's a string
                    const parsed = JSON.parse(actions)
                    selectedActions = Array.isArray(parsed) ? parsed : [parsed]
                } catch (error) {
                    // If parsing fails, it might be a single action
                    console.error('Error parsing actions:', error)
                    selectedActions = [actions] // Treat as single action
                }
            } else {
                console.error('Unexpected actions type:', typeof actions)
            }
        }
        
        // Use defaults if no valid actions were selected
        if (selectedActions.length === 0) {
            console.log('GmailAPI - No valid actions found, using defaults')
            selectedActions = ['readEmails', 'sendEmail']
        }
        
        console.log('GmailAPI - Selected actions:', selectedActions)

        // Get max results
        const maxResults = nodeData.inputs?.maxResults as number || 10

        // Initialize tools based on selected actions
        const toolArray: StructuredTool[] = []

        if (selectedActions.includes('readEmails')) {
            toolArray.push(new GmailReadTool(gmail, maxResults))
        }

        if (selectedActions.includes('sendEmail')) {
            toolArray.push(new GmailSendTool(gmail))
        }

        if (selectedActions.includes('draftEmail')) {
            toolArray.push(new GmailDraftTool(gmail))
        }

        if (selectedActions.includes('manageLabels')) {
            toolArray.push(new GmailLabelTool(gmail))
        }

        if (selectedActions.includes('manageEmails')) {
            toolArray.push(new GmailManageTool(gmail))
        }

        return toolArray
    }
    
    /**
     * Handle authentication button click
     * This function will be called from the frontend when the authenticate option is selected
     */
    async startGmailAuth(nodeData: INodeData, options: ICommonObject): Promise<{ authUrl: string }> {
        console.log('Starting Gmail authentication process...')
        try {
            // Get credential data
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            const clientId = getCredentialParam('clientId', credentialData, nodeData)
            const clientSecret = getCredentialParam('clientSecret', credentialData, nodeData)
            const redirectUri = getCredentialParam('redirectUri', credentialData, nodeData)

            if (!clientId || !clientSecret || !redirectUri) {
                throw new Error('Missing required credentials for Gmail API. Please configure the GmailOAuth credential first.')
            }

            console.log('Credentials validated, creating OAuth state...')

            // Create state parameter with node and credential info
            const state = Buffer.from(JSON.stringify({
                nodeId: nodeData.id,
                credentialId: nodeData.credential
            })).toString('base64')

            // Create OAuth2 client
            const oAuth2Client = new OAuth2Client({
                clientId,
                clientSecret,
                redirectUri
            })

            // Define scopes for Gmail API access
            const scopes = [
                'https://mail.google.com/',                          // Full access to the account (most permissive)
                'https://www.googleapis.com/auth/gmail.readonly',    // Read-only access
                'https://www.googleapis.com/auth/gmail.send',        // Send emails only
                'https://www.googleapis.com/auth/gmail.compose',     // Create, read, update drafts and send emails
                'https://www.googleapis.com/auth/gmail.modify',      // All read/write operations except permanent deletion
                'https://www.googleapis.com/auth/gmail.labels',      // Manage labels
                'https://www.googleapis.com/auth/gmail.settings.basic' // Manage basic settings
            ]
            
            console.log('Requesting Gmail API scopes:', scopes.join(', '))

            console.log('Generating authentication URL with scopes:', scopes.join(', '))

            // Generate authentication URL
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent',
                state
            })

            console.log('Authentication URL generated successfully')
            return { authUrl }
        } catch (error) {
            console.error('Error in startGmailAuth:', error)
            throw error
        }
    }
    
    /**
     * Handle OAuth callback
     * This function would be called by the backend when the OAuth callback is received
     */
    async handleOAuthCallback(code: string, nodeData: INodeData, options: ICommonObject): Promise<any> {
        let clientId: string, clientSecret: string, redirectUri: string;
        
        // Handle case where credential is 'new' vs an existing credential
        if (nodeData.credential === 'new') {
            // For new credentials, check if options contains the needed information
            if (options.credentialData) {
                const credData = options.credentialData as { clientId: string, clientSecret: string, redirectUri: string };
                clientId = credData.clientId;
                clientSecret = credData.clientSecret;
                redirectUri = credData.redirectUri;
                console.log('Using provided credential data for new OAuth flow');
            } else {
                throw new Error('Missing credential data for new OAuth credential');
            }
        } else {
            // For existing credentials, fetch from database
            const credentialData = await getCredentialData(nodeData.credential ?? '', options)
            clientId = getCredentialParam('clientId', credentialData, nodeData)
            clientSecret = getCredentialParam('clientSecret', credentialData, nodeData)
            redirectUri = getCredentialParam('redirectUri', credentialData, nodeData)
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

            // If successful, return tokens and user info
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

module.exports = { nodeClass: GmailAPI_Tools }