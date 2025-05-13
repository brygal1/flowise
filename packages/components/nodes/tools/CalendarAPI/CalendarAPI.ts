import { Tool, StructuredTool } from '@langchain/core/tools'
import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses, getCredentialData, getCredentialParam } from '../../../src/utils'
import { google, calendar_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { CalendarEventsTool, CalendarManageTool, CalendarAccessTool, CalendarSettingsTool, createCalendarClient } from './core'

class CalendarAPI_Tools implements INode {
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
        this.label = 'Google Calendar API'
        this.name = 'googleCalendarAPI'
        this.version = 1.0
        this.type = 'CalendarAPI'
        this.icon = 'calendar.svg'
        this.category = 'Tools'
        this.description = 'Access Google Calendar API for event management, scheduling, and calendar organization'
        this.baseClasses = [this.type, 'Tool']
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['googleCalendarOAuth']
        }
        this.inputs = [
            {
                label: 'Actions',
                name: 'actions',
                type: 'multiOptions',
                options: [
                    {
                        label: 'Manage Events',
                        name: 'manageEvents',
                        description: 'Create, read, update, and delete calendar events'
                    },
                    {
                        label: 'Manage Calendars',
                        name: 'manageCalendars',
                        description: 'List, create, update, and delete calendars'
                    },
                    {
                        label: 'Access Control',
                        name: 'accessControl',
                        description: 'Manage calendar sharing and access permissions'
                    },
                    {
                        label: 'Calendar Settings',
                        name: 'calendarSettings',
                        description: 'Get and update calendar settings'
                    }
                ],
                default: ['manageEvents', 'manageCalendars', 'accessControl', 'calendarSettings'],
                description: 'Select the Calendar actions to enable'
            },
            {
                label: 'Max Events to Fetch',
                name: 'maxResults',
                type: 'number',
                default: 10,
                description: 'Maximum number of events to fetch in a single request'
            },
            {
                label: 'Authenticate Calendar',
                name: 'authenticate',
                type: 'button',
                buttonText: '🔑 Authenticate Google Calendar Account',
                description: 'Click to start OAuth authentication with your Google Calendar account'
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
                description: 'Shows the current authentication status. If you encounter permission errors, you need to re-authenticate to grant full access permissions.',
                additionalParams: true,
                readonly: true
            }
        ]
    }

    /**
     * Initialize the Google Calendar API client and create tools based on selected actions
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
            throw new Error('Missing required credentials for Google Calendar API')
        }

        // Update the authentication status
        const isAuthenticated = accessToken && refreshToken
        if (nodeData.inputs) {
            nodeData.inputs.authStatus = isAuthenticated ? 'authenticated' : 'notAuthenticated'
        }

        if (!isAuthenticated) {
            throw new Error('Google Calendar account not authenticated. Please click the Authenticate button to connect your Google Calendar account.')
        }

        // Create client with credentials
        const credentials = { clientId, clientSecret, redirectUri }
        const token = { accessToken, refreshToken, tokenExpiry }

        console.log('CalendarAPI - Creating Google Calendar client with credentials and token')
        
        // Create Calendar client
        let calendar;
        try {
            calendar = await createCalendarClient(credentials, token)
            console.log('CalendarAPI - Google Calendar client created successfully')
        } catch (error) {
            console.error('CalendarAPI - Error creating Google Calendar client:', error)
            throw error
        }

        // Get selected actions
        const actions = nodeData.inputs?.actions
        let selectedActions: string[] = []
        
        if (actions) {
            console.log('CalendarAPI - Actions input type:', typeof actions, 'Value:', actions)
            
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
            console.log('CalendarAPI - No valid actions found, using defaults')
            selectedActions = ['manageEvents', 'manageCalendars']
        }
        
        console.log('CalendarAPI - Selected actions:', selectedActions)

        // Get max results
        const maxResults = nodeData.inputs?.maxResults as number || 10

        // Initialize tools based on selected actions
        const toolArray: StructuredTool[] = []

        if (selectedActions.includes('manageEvents')) {
            toolArray.push(new CalendarEventsTool(calendar, maxResults))
        }

        if (selectedActions.includes('manageCalendars')) {
            toolArray.push(new CalendarManageTool(calendar))
        }

        if (selectedActions.includes('accessControl')) {
            toolArray.push(new CalendarAccessTool(calendar))
        }

        if (selectedActions.includes('calendarSettings')) {
            toolArray.push(new CalendarSettingsTool(calendar))
        }

        return toolArray
    }
    
    /**
     * Handle authentication button click
     * This function will be called from the frontend when the authenticate option is selected
     */
    async startGmailAuth(nodeData: INodeData, options: ICommonObject): Promise<{ authUrl: string }> {
        console.log('Redirecting to new OAuth system...')
        
        // Make request to the new OAuth endpoint
        const response = await fetch(`${options.baseURL || ''}/api/v1/oauth/start/calendar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nodeData,
                nodeId: nodeData.id,
                credentialId: nodeData.credential,
                credentialData: nodeData.credential === 'new' ? {
                    clientId: nodeData.inputs?.clientId,
                    clientSecret: nodeData.inputs?.clientSecret,
                    redirectUri: nodeData.inputs?.redirectUri || 'http://localhost:8118/api/v1/oauth/callback/calendar'
                } : undefined
            })
        })
        
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Failed to start OAuth flow')
        }
        
        return await response.json()
    }
    
    /**
     * Handle OAuth callback
     * This function would be called by the backend when the OAuth callback is received
     */
    async handleOAuthCallback(code: string, nodeData: INodeData, options: ICommonObject): Promise<any> {
        console.log('Deprecated: handleOAuthCallback is now handled by the OAuth system')
        throw new Error('This method is deprecated. Please use the OAuth system instead.')
    }
}

module.exports = { nodeClass: CalendarAPI_Tools }