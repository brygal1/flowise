# Google Calendar API Integration

This component allows Flowise to interact with Google Calendar API for event management, scheduling, and calendar organization.

## Features

- Manage Calendar Events
  - Create, read, update, and delete events
  - Search for events by time range or query
  - Work with recurring events

- Manage Calendars 
  - List, create, update, and delete calendars
  - Clear events from calendars

- Access Control
  - Manage calendar sharing and permissions
  - Control who can view or edit your calendars

- Calendar Settings
  - View and manage Google Calendar settings

## Requirements

- A Google Cloud Platform account
- OAuth2 credentials (Client ID and Client Secret) with Google Calendar API enabled
- Properly configured OAuth redirect URI

## Authentication

This component uses OAuth2 authentication to securely access Google Calendar. You'll need to:

1. Create a Google Cloud Platform project
2. Enable the Google Calendar API
3. Configure OAuth consent screen
4. Create OAuth client credentials
5. Add the Flowise redirect URI to your OAuth configuration

See the [SETUP.md](./SETUP.md) file for detailed instructions on setting up authentication.

## Usage Examples

### List Upcoming Events

```json
{
  "action": "list",
  "calendarId": "primary",
  "timeMin": "2023-05-01T00:00:00Z",
  "timeMax": "2023-05-31T23:59:59Z",
  "maxResults": 10,
  "singleEvents": true,
  "orderBy": "startTime"
}
```

### Create a New Event

```json
{
  "action": "create",
  "calendarId": "primary",
  "event": {
    "summary": "Team Meeting",
    "description": "Weekly team sync-up",
    "location": "Conference Room A",
    "start": {
      "dateTime": "2023-05-10T10:00:00",
      "timeZone": "America/New_York"
    },
    "end": {
      "dateTime": "2023-05-10T11:00:00",
      "timeZone": "America/New_York"
    },
    "attendees": [
      {
        "email": "colleague@example.com"
      }
    ],
    "reminders": {
      "useDefault": false,
      "overrides": [
        {
          "method": "email",
          "minutes": 30
        },
        {
          "method": "popup",
          "minutes": 10
        }
      ]
    }
  }
}
```

## Troubleshooting

- **Authentication failures**: Ensure your redirect URI exactly matches what's configured in your Google Cloud Console
- **Permission errors**: Make sure the required OAuth scopes are enabled and the user has granted consent
- **Rate limits**: Google Calendar API has usage quotas; spread out requests to avoid hitting limits

For more information, see the [Google Calendar API documentation](https://developers.google.com/calendar/api/guides/overview).