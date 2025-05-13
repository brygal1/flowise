# Google Calendar API Setup Guide

This guide walks you through setting up the Google Calendar API credentials for use with Flowise.

## Step 1: Create a Google Cloud Platform Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the project dropdown at the top of the page.
3. Click "New Project" and give it a name, then click "Create".
4. Once created, make sure your new project is selected.

## Step 2: Enable the Google Calendar API

1. Navigate to "APIs & Services" > "Library" in the left sidebar.
2. Search for "Google Calendar API" and click on it.
3. Click the "Enable" button.

## Step 3: Configure OAuth Consent Screen

1. Navigate to "APIs & Services" > "OAuth consent screen" in the left sidebar.
2. Select "External" user type (unless you're using Google Workspace and want to restrict to your organization only).
3. Click "Create".
4. Fill in the required information:
   - App name: Your application name (e.g., "Flowise Calendar Integration")
   - User support email: Your email address
   - Developer contact information: Your email address
5. Click "Save and Continue".
6. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.settings.readonly`
7. Click "Save and Continue".
8. Add any test users if you are still in testing mode.
9. Click "Save and Continue".
10. Review your settings and click "Back to Dashboard".

## Step 4: Create OAuth Credentials

1. Navigate to "APIs & Services" > "Credentials" in the left sidebar.
2. Click the "Create Credentials" button and select "OAuth client ID".
3. Choose "Web application" as the application type.
4. Give it a name (e.g., "Flowise Calendar Integration").
5. Under "Authorized redirect URIs", add:
   - `http://localhost:8118/api/v1/oauth/callback/calendar` (for local development)
   - Add your production redirect URI if you're deploying to a server
6. Click "Create".
7. A modal will show your client ID and client secret. Keep these safe for the next step.

## Step 5: Configure Flowise

1. In Flowise, add a new "Google Calendar API" node to your canvas.
2. Click on "Create new" in the "Connect Credential" dropdown.
3. Fill in the form:
   - Client ID: Paste the client ID from step 4
   - Client Secret: Paste the client secret from step 4
   - Redirect URI: `http://localhost:8118/api/v1/oauth/callback/calendar` (adjust if needed)
4. Click "Save".
5. Click the "🔑 Start Calendar Authentication" button.
6. A popup window will appear for you to log in to your Google account and grant permissions.
7. After granting permissions, the popup will close, and the authentication status should show "✅ Authenticated".

## Step 6: Test the Integration

1. Configure your Calendar API node with the desired actions.
2. Connect it to your flow.
3. Test the flow to ensure the Google Calendar integration is working properly.

## Troubleshooting

### Authentication Failed

- Verify that your Client ID and Client Secret are correct.
- Ensure your Redirect URI matches exactly what's configured in the Google Cloud Console.
- Check that you've enabled the Google Calendar API in your Google Cloud project.

### Permission Errors

- Make sure all necessary scopes are added to your OAuth consent screen.
- You may need to re-authenticate if you've changed the required scopes.

### Development vs. Production

- Google OAuth has different requirements for published apps vs. development.
- If moving to production, ensure your app undergoes verification if you plan to make it available to more than just test users.

## Additional Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)