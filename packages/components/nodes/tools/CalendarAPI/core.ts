import { Tool, StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { google, calendar_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

// Calendar API Tool to manage events
export class CalendarEventsTool extends StructuredTool {
    name = 'calendar_events'
    description = 'Use this tool to create, read, update, and delete events in Google Calendar. You can create new events, search for existing events by time range or query, update event details, and delete events.'
    calendarClient: calendar_v3.Calendar
    maxResults: number

    constructor(calendarClient: calendar_v3.Calendar, maxResults: number = 10) {
        super()
        this.calendarClient = calendarClient
        this.maxResults = maxResults
    }

    schema = z.object({
        action: z.enum(['list', 'get', 'create', 'update', 'delete', 'instances']).describe('Action to perform on calendar events'),
        calendarId: z.string().default('primary').describe('Calendar ID to operate on. Use "primary" for the user\'s primary calendar or a specific calendar ID.'),
        eventId: z.string().optional().describe('ID of the event (required for get, update, delete, instances actions)'),
        timeMin: z.string().optional().describe('Start time for event search in RFC3339 format (e.g., "2023-12-01T00:00:00Z") for list action'),
        timeMax: z.string().optional().describe('End time for event search in RFC3339 format (e.g., "2023-12-31T23:59:59Z") for list action'),
        q: z.string().optional().describe('Free text search terms to find events that match for list action'),
        maxResults: z.number().optional().describe('Maximum number of events to return for list action (default and max is 250)'),
        singleEvents: z.boolean().optional().describe('Whether to expand recurring events into instances for list action'),
        orderBy: z.enum(['startTime', 'updated']).optional().describe('Order of events returned for list action'),
        event: z.object({
            summary: z.string().optional().describe('Title of the event'),
            description: z.string().optional().describe('Description of the event'),
            location: z.string().optional().describe('Location of the event'),
            start: z.object({
                dateTime: z.string().optional().describe('Start time in RFC3339 format (e.g., "2023-12-15T09:00:00-07:00")'),
                date: z.string().optional().describe('Start date in YYYY-MM-DD format (for all-day events)'),
                timeZone: z.string().optional().describe('Timezone for the start time (e.g., "America/Los_Angeles")')
            }).optional(),
            end: z.object({
                dateTime: z.string().optional().describe('End time in RFC3339 format (e.g., "2023-12-15T10:00:00-07:00")'),
                date: z.string().optional().describe('End date in YYYY-MM-DD format (for all-day events)'),
                timeZone: z.string().optional().describe('Timezone for the end time (e.g., "America/Los_Angeles")')
            }).optional(),
            attendees: z.array(z.object({
                email: z.string().describe('Email address of the attendee'),
                displayName: z.string().optional().describe('Display name of the attendee'),
                optional: z.boolean().optional().describe('Whether attendance is optional')
            })).optional().describe('List of attendees'),
            reminders: z.object({
                useDefault: z.boolean().optional().describe('Whether to use the default reminders'),
                overrides: z.array(z.object({
                    method: z.enum(['email', 'popup']).describe('Reminder method'),
                    minutes: z.number().describe('Minutes before the event to trigger the reminder')
                })).optional().describe('Custom reminders')
            }).optional(),
            transparency: z.enum(['opaque', 'transparent']).optional().describe('Whether the event blocks time on the calendar'),
            visibility: z.enum(['default', 'public', 'private', 'confidential']).optional().describe('Visibility of the event'),
            colorId: z.string().optional().describe('Color ID for the event')
        }).optional().describe('Event details for create and update actions')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, calendarId, eventId, timeMin, timeMax, q, maxResults, singleEvents, orderBy, event } = input

            // Check required parameters based on action
            if (['get', 'update', 'delete', 'instances'].includes(action) && !eventId) {
                return `Error: eventId is required for ${action} action`
            }

            if (['create', 'update'].includes(action) && !event) {
                return `Error: event details are required for ${action} action`
            }

            switch (action) {
                case 'list': {
                    const response = await this.calendarClient.events.list({
                        calendarId: calendarId,
                        timeMin: timeMin,
                        timeMax: timeMax,
                        q: q,
                        maxResults: maxResults || this.maxResults,
                        singleEvents: singleEvents,
                        orderBy: orderBy
                    })

                    if (!response.data.items || response.data.items.length === 0) {
                        return 'No events found matching the criteria.'
                    }

                    const events = response.data.items.map(event => ({
                        id: event.id,
                        summary: event.summary,
                        description: event.description,
                        location: event.location,
                        start: event.start,
                        end: event.end,
                        creator: event.creator,
                        organizer: event.organizer,
                        attendees: event.attendees,
                        status: event.status,
                        htmlLink: event.htmlLink,
                        created: event.created,
                        updated: event.updated,
                        recurrence: event.recurrence,
                        recurringEventId: event.recurringEventId
                    }))

                    return JSON.stringify(events, null, 2)
                }

                case 'get': {
                    const response = await this.calendarClient.events.get({
                        calendarId: calendarId,
                        eventId: eventId as string
                    })

                    return JSON.stringify(response.data, null, 2)
                }

                case 'create': {
                    const response = await this.calendarClient.events.insert({
                        calendarId: calendarId,
                        requestBody: event
                    })

                    return JSON.stringify({
                        message: 'Event created successfully',
                        event: {
                            id: response.data.id,
                            summary: response.data.summary,
                            htmlLink: response.data.htmlLink,
                            start: response.data.start,
                            end: response.data.end
                        }
                    }, null, 2)
                }

                case 'update': {
                    const response = await this.calendarClient.events.update({
                        calendarId: calendarId,
                        eventId: eventId as string,
                        requestBody: event
                    })

                    return JSON.stringify({
                        message: 'Event updated successfully',
                        event: {
                            id: response.data.id,
                            summary: response.data.summary,
                            htmlLink: response.data.htmlLink,
                            start: response.data.start,
                            end: response.data.end
                        }
                    }, null, 2)
                }

                case 'delete': {
                    await this.calendarClient.events.delete({
                        calendarId: calendarId,
                        eventId: eventId as string
                    })

                    return `Event deleted successfully. Event ID: ${eventId}`
                }

                case 'instances': {
                    const response = await this.calendarClient.events.instances({
                        calendarId: calendarId,
                        eventId: eventId as string,
                        maxResults: maxResults || this.maxResults
                    })

                    if (!response.data.items || response.data.items.length === 0) {
                        return 'No recurring event instances found.'
                    }

                    const instances = response.data.items.map(event => ({
                        id: event.id,
                        summary: event.summary,
                        start: event.start,
                        end: event.end,
                        status: event.status,
                        htmlLink: event.htmlLink,
                        recurringEventId: event.recurringEventId
                    }))

                    return JSON.stringify(instances, null, 2)
                }

                default:
                    return `Error: Unsupported action: ${action}`
            }
        } catch (error) {
            return `Error managing calendar events: ${error}`
        }
    }
}

// Calendar API Tool for calendar management
export class CalendarManageTool extends StructuredTool {
    name = 'calendar_manage'
    description = 'Use this tool to manage Google Calendars. You can list all available calendars, get details of a specific calendar, create new calendars, update existing calendars, and delete calendars.'
    calendarClient: calendar_v3.Calendar

    constructor(calendarClient: calendar_v3.Calendar) {
        super()
        this.calendarClient = calendarClient
    }

    schema = z.object({
        action: z.enum(['list', 'get', 'create', 'update', 'delete', 'clear']).describe('Action to perform on calendars'),
        calendarId: z.string().optional().describe('Calendar ID (required for get, update, delete, clear actions, default is "primary" for the user\'s primary calendar)'),
        calendar: z.object({
            summary: z.string().optional().describe('Title of the calendar'),
            description: z.string().optional().describe('Description of the calendar'),
            location: z.string().optional().describe('Geographic location of the calendar'),
            timeZone: z.string().optional().describe('The timezone of the calendar (e.g., "America/Los_Angeles")'),
            colorId: z.string().optional().describe('Color ID for the calendar')
        }).optional().describe('Calendar details for create and update actions')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, calendarId = 'primary', calendar } = input

            // Check required parameters based on action
            if (['get', 'update', 'delete', 'clear'].includes(action) && !calendarId) {
                return `Error: calendarId is required for ${action} action`
            }

            if (['create', 'update'].includes(action) && !calendar) {
                return `Error: calendar details are required for ${action} action`
            }

            switch (action) {
                case 'list': {
                    const response = await this.calendarClient.calendarList.list()

                    if (!response.data.items || response.data.items.length === 0) {
                        return 'No calendars found.'
                    }

                    const calendars = response.data.items.map(cal => ({
                        id: cal.id,
                        summary: cal.summary,
                        description: cal.description,
                        location: cal.location,
                        timeZone: cal.timeZone,
                        colorId: cal.colorId,
                        backgroundColor: cal.backgroundColor,
                        foregroundColor: cal.foregroundColor,
                        primary: cal.primary,
                        accessRole: cal.accessRole
                    }))

                    return JSON.stringify(calendars, null, 2)
                }

                case 'get': {
                    const response = await this.calendarClient.calendars.get({
                        calendarId: calendarId
                    })

                    return JSON.stringify(response.data, null, 2)
                }

                case 'create': {
                    const response = await this.calendarClient.calendars.insert({
                        requestBody: calendar
                    })

                    return JSON.stringify({
                        message: 'Calendar created successfully',
                        calendar: {
                            id: response.data.id,
                            summary: response.data.summary,
                            timeZone: response.data.timeZone
                        }
                    }, null, 2)
                }

                case 'update': {
                    const response = await this.calendarClient.calendars.update({
                        calendarId: calendarId,
                        requestBody: calendar
                    })

                    return JSON.stringify({
                        message: 'Calendar updated successfully',
                        calendar: {
                            id: response.data.id,
                            summary: response.data.summary,
                            timeZone: response.data.timeZone
                        }
                    }, null, 2)
                }

                case 'delete': {
                    await this.calendarClient.calendars.delete({
                        calendarId: calendarId
                    })

                    return `Calendar deleted successfully. Calendar ID: ${calendarId}`
                }

                case 'clear': {
                    await this.calendarClient.calendars.clear({
                        calendarId: calendarId
                    })

                    return `All events deleted from calendar successfully. Calendar ID: ${calendarId}`
                }

                default:
                    return `Error: Unsupported action: ${action}`
            }
        } catch (error) {
            return `Error managing calendars: ${error}`
        }
    }
}

// Calendar API Tool for access control
export class CalendarAccessTool extends StructuredTool {
    name = 'calendar_access'
    description = 'Use this tool to manage access control for Google Calendars. You can get, add, update, and remove access permissions (ACLs) for a calendar.'
    calendarClient: calendar_v3.Calendar

    constructor(calendarClient: calendar_v3.Calendar) {
        super()
        this.calendarClient = calendarClient
    }

    schema = z.object({
        action: z.enum(['list', 'get', 'insert', 'update', 'delete']).describe('Action to perform on calendar ACLs'),
        calendarId: z.string().describe('Calendar ID to manage access for, use "primary" for the user\'s primary calendar'),
        ruleId: z.string().optional().describe('ACL rule ID (required for get, update, delete actions)'),
        rule: z.object({
            role: z.enum(['none', 'freeBusyReader', 'reader', 'writer', 'owner']).describe('Access role to grant'),
            scope: z.object({
                type: z.enum(['default', 'user', 'group', 'domain']).describe('Type of scope'),
                value: z.string().optional().describe('Scope value (email address, domain name, etc.)')
            }).describe('Scope of the rule - who it applies to')
        }).optional().describe('ACL rule details for insert and update actions')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, calendarId, ruleId, rule } = input

            // Check required parameters based on action
            if (['get', 'update', 'delete'].includes(action) && !ruleId) {
                return `Error: ruleId is required for ${action} action`
            }

            if (['insert', 'update'].includes(action) && !rule) {
                return `Error: rule details are required for ${action} action`
            }

            switch (action) {
                case 'list': {
                    const response = await this.calendarClient.acl.list({
                        calendarId: calendarId
                    })

                    if (!response.data.items || response.data.items.length === 0) {
                        return 'No access rules found for this calendar.'
                    }

                    return JSON.stringify(response.data.items, null, 2)
                }

                case 'get': {
                    const response = await this.calendarClient.acl.get({
                        calendarId: calendarId,
                        ruleId: ruleId as string
                    })

                    return JSON.stringify(response.data, null, 2)
                }

                case 'insert': {
                    const response = await this.calendarClient.acl.insert({
                        calendarId: calendarId,
                        requestBody: rule
                    })

                    return JSON.stringify({
                        message: 'Access rule created successfully',
                        rule: response.data
                    }, null, 2)
                }

                case 'update': {
                    const response = await this.calendarClient.acl.update({
                        calendarId: calendarId,
                        ruleId: ruleId as string,
                        requestBody: rule
                    })

                    return JSON.stringify({
                        message: 'Access rule updated successfully',
                        rule: response.data
                    }, null, 2)
                }

                case 'delete': {
                    await this.calendarClient.acl.delete({
                        calendarId: calendarId,
                        ruleId: ruleId as string
                    })

                    return `Access rule deleted successfully. Rule ID: ${ruleId}`
                }

                default:
                    return `Error: Unsupported action: ${action}`
            }
        } catch (error) {
            return `Error managing calendar access: ${error}`
        }
    }
}

// Calendar API Tool for settings
export class CalendarSettingsTool extends StructuredTool {
    name = 'calendar_settings'
    description = 'Use this tool to get and update user settings for Google Calendar. You can retrieve all settings or a specific setting.'
    calendarClient: calendar_v3.Calendar

    constructor(calendarClient: calendar_v3.Calendar) {
        super()
        this.calendarClient = calendarClient
    }

    schema = z.object({
        action: z.enum(['list', 'get']).describe('Action to perform on calendar settings'),
        setting: z.string().optional().describe('Setting ID to retrieve (required for get action)')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, setting } = input

            // Check required parameters based on action
            if (action === 'get' && !setting) {
                return 'Error: setting ID is required for get action'
            }

            switch (action) {
                case 'list': {
                    const response = await this.calendarClient.settings.list()

                    if (!response.data.items || response.data.items.length === 0) {
                        return 'No settings found.'
                    }

                    return JSON.stringify(response.data.items, null, 2)
                }

                case 'get': {
                    const response = await this.calendarClient.settings.get({
                        setting: setting as string
                    })

                    return JSON.stringify(response.data, null, 2)
                }

                default:
                    return `Error: Unsupported action: ${action}`
            }
        } catch (error) {
            return `Error managing calendar settings: ${error}`
        }
    }
}

// Helper function to create Calendar client
export async function createCalendarClient(credentials: any, token: any): Promise<calendar_v3.Calendar> {
    const oAuth2Client = new OAuth2Client({
        clientId: credentials.clientId || credentials.client_id,
        clientSecret: credentials.clientSecret || credentials.client_secret,
        redirectUri: credentials.redirectUri || credentials.redirect_uri
    })

    oAuth2Client.setCredentials({
        access_token: token.accessToken || token.access_token,
        refresh_token: token.refreshToken || token.refresh_token,
        expiry_date: token.tokenExpiry || token.expiry_date
    })

    const calendarClient = google.calendar({
        version: 'v3',
        auth: oAuth2Client as any
    })

    return calendarClient
}