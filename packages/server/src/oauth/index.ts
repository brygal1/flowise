import { OAuthProviderRegistry } from '../utils/OAuthProviderRegistry'
import { gmailProvider } from './GmailProvider'
import { googleCalendarProvider } from './GoogleCalendarProvider'

/**
 * Register all OAuth providers
 * This function must be called during server initialization
 */
export function registerOAuthProviders(): void {
    const registry = OAuthProviderRegistry.getInstance()
    
    // Register Google providers
    registry.registerProvider(gmailProvider)
    registry.registerProvider(googleCalendarProvider)
    
    // Add any additional providers here
    
    console.log(`Registered ${registry.getAllProviders().length} OAuth providers`)
}