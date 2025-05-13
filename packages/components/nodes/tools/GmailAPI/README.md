# Gmail API Tool for Flowise

This tool integrates Gmail API functionality into Flowise, allowing AI agents to interact with Gmail emails, drafts, and labels. The tool provides comprehensive email management capabilities including reading, sending, organizing emails, managing labels, and handling attachments.

## Features

- **Authentication**: OAuth2 authentication with Gmail API
- **Email Retrieval**: Search and read emails with filters
- **Email Composition**: Send emails with optional attachments
- **Draft Management**: Create, update, send, and delete drafts
- **Label Management**: Create, list, update, and delete Gmail labels
- **Email Organization**: Archive, delete, mark as read/unread, move emails between labels
- **Attachment Handling**: Support for viewing and adding attachments

## Setup

### Prerequisites

1. Set up a Google Cloud Project and enable the Gmail API
2. Create OAuth2 credentials in the Google Cloud Console
3. Configure the OAuth consent screen
4. Add authorized redirect URIs for your Flowise instance

### Configuration

1. Add your Gmail OAuth credentials in Flowise:
   - Client ID
   - Client Secret
   - Redirect URI

2. Click the "Authenticate" button to connect your Gmail account

## Usage

### Available Tools

The Gmail API Tool provides five main tools:

1. **Gmail Read Tool**: Search and read emails
   - Options for query search, label filters, and attachment inclusion

2. **Gmail Send Tool**: Compose and send emails
   - Support for CC, BCC, and attachments
   - HTML or plain text format options

3. **Gmail Draft Tool**: Manage email drafts
   - Create, update, delete, send, and list drafts

4. **Gmail Label Tool**: Manage email labels
   - Create, list, update, and delete labels
   - Apply labels to emails
   - Customize label colors

5. **Gmail Manage Tool**: Organize emails
   - Archive, delete, mark as read/unread
   - Move emails between labels
   - Trash/untrash and star/unstar emails

### Tool Selection

When adding the Gmail API node to your flow, you can select which tools to enable:
- Read Emails
- Send Email
- Draft Email
- Manage Labels
- Manage Emails

### Configuration Options

- **Max Emails to Fetch**: Set the maximum number of emails to retrieve in a single request
- **Authentication**: Authenticate with your Gmail account using the "Authenticate Gmail" button

## Authentication Process

1. Click the "Authenticate Gmail" button in the Gmail API node
2. You will be redirected to the Google OAuth consent screen
3. Grant the required permissions to access your Gmail account
4. After successful authentication, you will be redirected back to Flowise
5. Your access tokens will be securely stored for future use

## Examples

### Reading Emails

The Gmail Read Tool can search emails with specific criteria:

```javascript
// Example input to read emails
{
  "query": "from:example@gmail.com subject:important",
  "labelIds": ["INBOX", "IMPORTANT"],
  "maxResults": 5,
  "includeAttachments": true
}
```

### Sending Emails

The Gmail Send Tool allows composing and sending emails:

```javascript
// Example input to send an email
{
  "to": "recipient@example.com",
  "subject": "Meeting Reminder",
  "body": "<p>Hello,</p><p>This is a reminder about our meeting tomorrow.</p>",
  "cc": "colleague@example.com",
  "isHtml": true
}
```

### Managing Labels

The Gmail Label Tool provides label management:

```javascript
// Example input to create a new label
{
  "action": "create",
  "name": "Project X",
  "color": {
    "textColor": "#ffffff",
    "backgroundColor": "#4986e7"
  }
}
```

### Managing Emails

The Gmail Manage Tool enables organizational actions:

```javascript
// Example input to archive multiple emails
{
  "action": "archive",
  "messageIds": ["1234abc", "5678def"]
}
```

## Security Considerations

- The tool uses OAuth2 for secure authentication with Gmail API
- Access and refresh tokens are stored securely
- The tool requests only the necessary permission scopes
- Token refresh is handled automatically when needed

## Troubleshooting

- If authentication fails, verify your Google Cloud Console OAuth credentials
- Ensure the redirect URI in Flowise matches the one configured in Google Cloud Console
- Check that you've enabled the Gmail API in your Google Cloud Project
- For rate limit issues, consider implementing exponential backoff or quota handling