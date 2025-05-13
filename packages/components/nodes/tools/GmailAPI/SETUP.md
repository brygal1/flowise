# Setting Up Gmail API OAuth for Flowise

This guide will walk you through the process of setting up OAuth 2.0 credentials in Google Cloud Console to use with the Gmail API tool in Flowise.

## Prerequisites

- A Google account
- A Flowise installation running (locally or deployed)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click on "New Project"
4. Enter a name for your project (e.g., "Flowise Gmail Integration")
5. Click "Create"

## Step 2: Enable the Gmail API

1. Select your newly created project
2. Go to the "APIs & Services" > "Library" section
3. Search for "Gmail API"
4. Click on "Gmail API" in the search results
5. Click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (or "Internal" if you're using Google Workspace)
3. Click "Create"
4. Fill out the required information:
   - App name: "Flowise Gmail Integration"
   - User support email: Your email address
   - Developer contact information: Your email address
5. Click "Save and Continue"
6. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
7. Click "Save and Continue"
8. Add any test users if needed (for external user type)
9. Click "Save and Continue"
10. Review your settings and click "Back to Dashboard"

## Step 4: Create OAuth 2.0 Client ID Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Name: "Flowise Gmail Integration"
5. Under "Authorized JavaScript origins", add your Flowise origin:
   - For local development: `http://localhost:3033`
   - For production: Your deployed Flowise URL
6. Under "Authorized redirect URIs", add:
   - For local development: `http://localhost:3033/api/oauth/callback/gmail`
   - For production: `https://your-flowise-domain.com/api/oauth/callback/gmail`
7. Click "Create"
8. Take note of the **Client ID** and **Client Secret** provided. You'll need these for Flowise.

## Step 5: Configure Flowise

1. Open Flowise and go to the Credentials section
2. Create a new credential of type "Gmail OAuth"
3. Fill in the details:
   - Client ID: The Client ID from Google Cloud Console
   - Client Secret: The Client Secret from Google Cloud Console
   - Redirect URI: The same redirect URI you configured in Google Cloud Console
     (e.g., `http://localhost:3033/api/oauth/callback/gmail`)
4. Save the credential

## Step 6: Authenticate with Gmail

1. Create a new workflow or open an existing one
2. Add the "Gmail API" tool to your workflow
3. Select the credential you created
4. Choose the actions you want to enable (Read Emails, Send Email, etc.)
5. Click the "Authenticate Gmail" button
6. A new window will open with the Google consent screen
7. Follow the prompts to allow access to your Gmail account
8. After successful authentication, the window will close automatically
9. Your Gmail API tool is now authenticated and ready to use!

## Troubleshooting

- **Authentication Failed**: Make sure your Client ID, Client Secret, and Redirect URI exactly match what's configured in Google Cloud Console.
- **Redirect URI Mismatch**: The redirect URI in Flowise must exactly match one of the redirect URIs configured in Google Cloud Console.
- **Access Denied**: Ensure you've enabled all the required scopes in the OAuth consent screen.
- **API Not Enabled**: Make sure the Gmail API is enabled for your project.

## Security Considerations

- Store your Client Secret securely
- Only request the OAuth scopes you need
- For production use, complete the verification process for your OAuth consent screen if using the "External" user type

## Need Help?

If you encounter any issues, please:
1. Check the Flowise server logs for detailed error messages
2. Refer to the [Gmail API documentation](https://developers.google.com/gmail/api)
3. Visit the [Flowise community](https://github.com/FlowiseAI/Flowise/discussions) for support