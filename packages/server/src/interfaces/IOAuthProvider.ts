import { INodeData } from '../Interface'
import { ICommonObject } from 'flowise-components'

/**
 * Interface for OAuth Providers
 */
export interface IOAuthProvider {
    /**
     * Unique identifier for this OAuth provider (e.g., 'gmail', 'calendar')
     */
    providerKey: string
    
    /**
     * Display name for the provider shown in UI (e.g., 'Gmail', 'Google Calendar')
     */
    displayName: string

    /**
     * The credential type associated with this provider (e.g., 'gmailOAuth', 'googleCalendarOAuth')
     */
    credentialType: string

    /**
     * OAuth scopes required by this provider
     */
    scopes: string[]

    /**
     * Start the OAuth flow by generating an authorization URL
     */
    startOAuth(nodeData: INodeData, options: ICommonObject): Promise<{ authUrl: string }>
    
    /**
     * Handle the OAuth callback - exchange code for tokens and validate the connection
     */
    handleOAuthCallback(code: string, nodeData: INodeData, options: ICommonObject): Promise<any>
}