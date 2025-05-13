import { IOAuthProvider } from '../interfaces/IOAuthProvider'
import { InternalFlowiseError } from '../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

/**
 * Registry for OAuth providers
 */
export class OAuthProviderRegistry {
    private static instance: OAuthProviderRegistry
    private providers: Map<string, IOAuthProvider> = new Map()

    private constructor() {
        // Private constructor to enforce singleton
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): OAuthProviderRegistry {
        if (!OAuthProviderRegistry.instance) {
            OAuthProviderRegistry.instance = new OAuthProviderRegistry()
        }
        return OAuthProviderRegistry.instance
    }

    /**
     * Register a provider
     */
    public registerProvider(provider: IOAuthProvider): void {
        this.providers.set(provider.providerKey, provider)
        console.log(`OAuth provider registered: ${provider.displayName} (${provider.providerKey})`)
    }

    /**
     * Get a provider by key
     */
    public getProvider(key: string): IOAuthProvider {
        const provider = this.providers.get(key)
        if (!provider) {
            throw new InternalFlowiseError(
                StatusCodes.NOT_FOUND, 
                `OAuth provider not found: ${key}`
            )
        }
        return provider
    }

    /**
     * Get all registered providers
     */
    public getAllProviders(): IOAuthProvider[] {
        return Array.from(this.providers.values())
    }

    /**
     * Check if a provider exists
     */
    public hasProvider(key: string): boolean {
        return this.providers.has(key)
    }
}