import { INodeData } from '../Interface'
import { ICommonObject } from 'flowise-components'
import { IOAuthProvider } from '../interfaces/IOAuthProvider'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { getErrorMessage } from '../errors/utils'

/**
 * This is a base abstract class for OAuth providers
 * It implements common functionality and auto-registers the provider when instantiated
 */
export abstract class OAuthBaseProvider implements IOAuthProvider {
    /**
     * Unique identifier for this OAuth provider
     */
    abstract providerKey: string
    
    /**
     * Display name for the provider shown in UI
     */
    abstract displayName: string

    /**
     * The credential type that this provider is associated with
     */
    abstract credentialType: string

    /**
     * OAuth scopes required by this provider
     */
    abstract scopes: string[]

    /**
     * Icon path for visual identification in the UI
     */
    iconPath?: string

    /**
     * Start the OAuth flow by generating an authorization URL
     */
    abstract startOAuth(nodeData: INodeData, options: ICommonObject): Promise<{ authUrl: string }>
    
    /**
     * Handle the OAuth callback - exchange code for tokens and validate the connection
     */
    abstract handleOAuthCallback(code: string, nodeData: INodeData, options: ICommonObject): Promise<any>
    
    /**
     * Common token validation method for providers
     */
    protected async validateTokens(token: any): Promise<boolean> {
        if (!token || !token.access_token) {
            return false
        }
        
        // Different providers have different token formats
        // This is a simple validation - subclasses can override for more specific checks
        return true
    }
    
    /**
     * Common error handling method for OAuth operations
     */
    protected handleOAuthError(error: any, operation: string): never {
        console.error(`OAuth Error in ${this.providerKey} provider during ${operation}:`, error)
        
        // Map common OAuth errors to more user-friendly messages
        let errorMessage = getErrorMessage(error)
        
        if (errorMessage.includes('invalid_client')) {
            errorMessage = 'Invalid client credentials. Please verify your Client ID and Client Secret are correct.'
        } else if (errorMessage.includes('redirect_uri_mismatch')) {
            errorMessage = 'Redirect URI mismatch. Please ensure the redirect URI matches what is configured in your OAuth settings.'
        } else if (errorMessage.includes('access_denied')) {
            errorMessage = 'Access was denied. The user may have declined authorization, or the request may be missing required parameters.'
        }
        
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `${this.displayName} authentication error: ${errorMessage}`
        )
    }
    
    /**
     * Register this provider when instantiated
     * This will be called from the OAuthProviderRegistry
     */
    registerProvider(): void {
        try {
            // The actual registration logic is handled in the OAuthProviderRegistry
            // This method will be called from there
            console.log(`OAuth provider registered: ${this.providerKey}`)
        } catch (error) {
            console.error(`Failed to register OAuth provider ${this.providerKey}:`, error)
        }
    }
}