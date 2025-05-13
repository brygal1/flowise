import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

// If modifying these scopes, delete token.json.
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.settings.readonly'
]

// The file token.json stores the user's access and refresh tokens
const TOKEN_PATH = path.join(process.cwd(), 'calendar-token.json')
// The file credentials.json stores the app's OAuth client credentials
const CREDENTIALS_PATH = path.join(process.cwd(), 'calendar-credentials.json')

/**
 * Reads previously authorized credentials from the save file.
 */
export async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const content = fs.readFileSync(TOKEN_PATH, 'utf-8')
            const credentials = JSON.parse(content)
            
            // Create a new OAuth2Client with the credentials
            const clientId = credentials.client_id || credentials.installed?.client_id
            const clientSecret = credentials.client_secret || credentials.installed?.client_secret
            const redirectUri = credentials.redirect_uri || credentials.installed?.redirect_uris?.[0] || 'http://localhost'
            
            const client = new OAuth2Client({
                clientId,
                clientSecret,
                redirectUri
            })
            
            // Set the credentials
            client.setCredentials({
                refresh_token: credentials.refresh_token,
                access_token: credentials.access_token,
                expiry_date: credentials.expiry_date
            })
            
            return client
        }
        return null
    } catch (err) {
        console.error('Error loading saved credentials:', err)
        return null
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 */
export async function saveCredentials(client: OAuth2Client, credentialData: any): Promise<void> {
    const key = credentialData.installed || credentialData.web || credentialData
    const payload = {
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
        access_token: client.credentials.access_token,
        expiry_date: client.credentials.expiry_date
    }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(payload))
}

/**
 * Load or request authorization to call APIs.
 */
export async function authorize(credentialData: any): Promise<OAuth2Client> {
    // Check if we have previously stored token
    const client = await loadSavedCredentialsIfExist()
    if (client) {
        return client
    }
    
    // Create a new OAuth2Client
    const oauth2Client = new OAuth2Client({
        clientId: credentialData.clientId,
        clientSecret: credentialData.clientSecret,
        redirectUri: credentialData.redirectUri
    })
    
    // Generate an authentication URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    })
    
    // At this point, the user needs to visit the authUrl and grant permission
    // After authorization, the OAuth2 callback will receive the code
    // This would be handled by a separate endpoint in your application
    
    // This is a placeholder for the actual OAuth flow
    console.log('Authorize this app by visiting this URL:', authUrl)
    console.log('After authorization, the code will be passed to your redirect URI')
    
    // Return the OAuth2Client for now, it doesn't have tokens yet
    return oauth2Client
}

/**
 * Handle the OAuth callback and exchange the code for tokens
 */
export async function handleOAuthCallback(code: string, credentialData: any): Promise<OAuth2Client> {
    const oauth2Client = new OAuth2Client({
        clientId: credentialData.clientId,
        clientSecret: credentialData.clientSecret,
        redirectUri: credentialData.redirectUri
    })
    
    // Exchange the code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    
    // Save the credentials for future use
    await saveCredentials(oauth2Client, {
        installed: {
            client_id: credentialData.clientId,
            client_secret: credentialData.clientSecret
        }
    })
    
    return oauth2Client
}

/**
 * Creates a Calendar API client
 */
export async function createCalendarClient(oauth2Client: OAuth2Client): Promise<any> {
    // Cast as any to resolve type conflicts
    return google.calendar({
        version: 'v3', 
        auth: oauth2Client as any
    })
}

/**
 * Revokes access tokens and deletes stored tokens
 */
export async function revokeAccess(oauth2Client: OAuth2Client): Promise<boolean> {
    try {
        // Revoke tokens if available
        if (oauth2Client.credentials.access_token) {
            await oauth2Client.revokeToken(oauth2Client.credentials.access_token as string)
        }
        
        // Delete token file if it exists
        if (fs.existsSync(TOKEN_PATH)) {
            fs.unlinkSync(TOKEN_PATH)
        }
        
        return true
    } catch (error) {
        console.error('Error revoking access:', error)
        return false
    }
}