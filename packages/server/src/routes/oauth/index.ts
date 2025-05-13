import express from 'express'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import credentialsService from '../../services/credentials'
import nodesService from '../../services/nodes'
import { Credential } from '../../database/entities/Credential'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import path from 'path'

const router = express.Router()

/**
 * OAuth callback route
 * @param provider - The OAuth provider (e.g., gmail)
 * @param code - The authorization code from OAuth provider
 * @param state - Base64 encoded JSON containing nodeId and credentialId
 */
router.get('/callback/:provider', async (req, res) => {
    const { provider } = req.params
    const { code, state } = req.query

    if (!code || !state) {
        return res.status(400).send(`
            <html>
                <head>
                    <title>Authentication Failed</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding-top: 50px;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            border: 1px solid #e0e0e0;
                            border-radius: 5px;
                        }
                        .error {
                            color: #d32f2f;
                        }
                        .button {
                            display: inline-block;
                            background-color: #4CAF50;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 5px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="error">Authentication Failed</h1>
                        <p>Missing required parameters.</p>
                        <p>Please try again or contact support if the issue persists.</p>
                        <button onclick="window.close();" class="button">Close Window</button>
                    </div>
                    <script>
                        setTimeout(() => {
                            window.close();
                        }, 5000);
                    </script>
                </body>
            </html>
        `)
    }

    try {
        // Decode state parameter
        let stateData
        try {
            stateData = JSON.parse(Buffer.from(state as string, 'base64').toString())
            console.log('Successfully decoded OAuth state parameter')
        } catch (error) {
            console.error('Failed to decode state parameter:', error)
            return res.status(400).send(`
                <html>
                    <head>
                        <title>Authentication Failed</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                padding-top: 50px;
                            }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                border: 1px solid #e0e0e0;
                                border-radius: 5px;
                            }
                            .error {
                                color: #d32f2f;
                            }
                            .button {
                                display: inline-block;
                                background-color: #4CAF50;
                                color: white;
                                padding: 10px 20px;
                                text-decoration: none;
                                border-radius: 5px;
                                margin-top: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1 class="error">Authentication Failed</h1>
                            <p>Invalid state parameter.</p>
                            <p>Please try again or contact support if the issue persists.</p>
                            <button onclick="window.close();" class="button">Close Window</button>
                        </div>
                        <script>
                            setTimeout(() => {
                                window.close();
                            }, 5000);
                        </script>
                    </body>
                </html>
            `)
        }

        // Extract data from state parameter
        const { nodeId, credentialId, credentialData } = stateData

        if (provider === 'gmail') {
            // Handle new credential creation vs. updating existing credential
            let credential: any = null
            
            if (credentialId === 'new') {
                // This is a new credential being created - we'll handle it later
                console.log('New credential is being created during OAuth flow')
            } else {
                // Fetch existing credential
                credential = await credentialsService.getCredentialById(credentialId)
                
                if (!credential) {
                    return res.status(404).send(`
                    <html>
                        <head>
                            <title>Authentication Failed</title>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    text-align: center;
                                    padding-top: 50px;
                                }
                                .container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    padding: 20px;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 5px;
                                }
                                .error {
                                    color: #d32f2f;
                                }
                                .button {
                                    display: inline-block;
                                    background-color: #4CAF50;
                                    color: white;
                                    padding: 10px 20px;
                                    text-decoration: none;
                                    border-radius: 5px;
                                    margin-top: 20px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1 class="error">Authentication Failed</h1>
                                <p>Credential not found.</p>
                                <p>Please try again or contact support if the issue persists.</p>
                                <button onclick="window.close();" class="button">Close Window</button>
                            </div>
                            <script>
                                setTimeout(() => {
                                    window.close();
                                }, 5000);
                            </script>
                        </body>
                    </html>
                `)
                }
            }

            try {
                // Access the Gmail API component directly from the nodesPool
                const appServer = getRunningExpressApp()
                const gmailToolInstance = appServer.nodesPool.componentNodes['gmailAPI']

                if (!gmailToolInstance) {
                    throw new Error('Gmail API component not found')
                }

                // The component is already instantiated, we can use it directly
                const gmailTool = gmailToolInstance

                // Call the handleOAuthCallback method with type assertion
                // Since handleOAuthCallback is not in the INode interface, we need to use type assertion
                const gmailToolWithAuth = gmailTool as any
                
                // Prepare options with credential data from the state parameter if available
                const options: { credentialData?: { clientId: string, clientSecret: string, redirectUri: string } } = {};
                
                if (credentialId === 'new' && credentialData) {
                    // For new credentials, use the credential data from the state parameter
                    console.log('Using credential data from state parameter for new credential')
                    options.credentialData = credentialData;
                }
                
                const result = await gmailToolWithAuth.handleOAuthCallback(
                    code as string,
                    { credential: credentialId, id: nodeId },
                    options
                )

                if (result.authenticated) {
                    try {
                        // Handle different cases for 'new' credential vs. updating existing credential
                        if (credentialId === 'new') {
                            // For new credentials, create the credential directly in the database
                            console.log('New credential authentication successful. Creating credential in database.')
                            try {
                                if (!credentialData) {
                                    throw new Error('Missing credential data for new credential');
                                }
                                
                                // Create a new credential entry
                                await credentialsService.createCredential({
                                    name: 'Gmail OAuth',
                                    credentialName: 'gmailOAuth',
                                    plainDataObj: {
                                        clientId: credentialData.clientId,
                                        clientSecret: credentialData.clientSecret,
                                        redirectUri: credentialData.redirectUri,
                                        accessToken: result.accessToken,
                                        refreshToken: result.refreshToken,
                                        tokenExpiry: result.tokenExpiry,
                                        authStatus: 'authenticated'
                                    }
                                });
                                console.log('Successfully created new credential with tokens');
                            } catch (createError) {
                                console.error('Error creating new credential:', createError);
                            }
                        } else {
                            // Update existing credential with the tokens and auth status
                            await credentialsService.updateCredential(credentialId, {
                                plainDataObj: {
                                    accessToken: result.accessToken,
                                    refreshToken: result.refreshToken,
                                    tokenExpiry: result.tokenExpiry,
                                    authStatus: 'authenticated'
                                }
                            })
                            console.log('Successfully updated credential with tokens and auth status')
                        }
                    } catch (updateError) {
                        console.error('Error handling credentials:', updateError)
                    }

                    // Return success page
                    return res.send(`
                        <html>
                            <head>
                                <title>Authentication Successful</title>
                                <style>
                                    body {
                                        font-family: Arial, sans-serif;
                                        text-align: center;
                                        padding-top: 50px;
                                    }
                                    .container {
                                        max-width: 600px;
                                        margin: 0 auto;
                                        padding: 20px;
                                        border: 1px solid #e0e0e0;
                                        border-radius: 5px;
                                    }
                                    .success {
                                        color: #4CAF50;
                                    }
                                    .button {
                                        display: inline-block;
                                        background-color: #4CAF50;
                                        color: white;
                                        padding: 10px 20px;
                                        text-decoration: none;
                                        border-radius: 5px;
                                        margin-top: 20px;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1 class="success">Authentication Successful</h1>
                                    <p>Your Gmail account has been successfully connected.</p>
                                    <p>You can close this window and return to Flowise.</p>
                                    <button onclick="window.close();" class="button">Close Window</button>
                                </div>
                                <script>
                                    setTimeout(() => {
                                        window.close();
                                    }, 3000);
                                </script>
                            </body>
                        </html>
                    `)
                } else {
                    // Update the credential with failed authentication status if it's not new
                    if (credentialId !== 'new') {
                        await credentialsService.updateCredential(credentialId, {
                            plainDataObj: {
                                authStatus: 'notAuthenticated'
                            }
                        });
                    }

                    // Return error page
                    return res.status(400).send(`
                        <html>
                            <head>
                                <title>Authentication Failed</title>
                                <style>
                                    body {
                                        font-family: Arial, sans-serif;
                                        text-align: center;
                                        padding-top: 50px;
                                    }
                                    .container {
                                        max-width: 600px;
                                        margin: 0 auto;
                                        padding: 20px;
                                        border: 1px solid #e0e0e0;
                                        border-radius: 5px;
                                    }
                                    .error {
                                        color: #d32f2f;
                                    }
                                    .button {
                                        display: inline-block;
                                        background-color: #4CAF50;
                                        color: white;
                                        padding: 10px 20px;
                                        text-decoration: none;
                                        border-radius: 5px;
                                        margin-top: 20px;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1 class="error">Authentication Failed</h1>
                                    <p>Error: ${result.error || 'Unknown error'}</p>
                                    <p>Please try again or contact support if the issue persists.</p>
                                    <button onclick="window.close();" class="button">Close Window</button>
                                </div>
                                <script>
                                    setTimeout(() => {
                                        window.close();
                                    }, 5000);
                                </script>
                            </body>
                        </html>
                    `)
                }
            } catch (error) {
                console.error('Error in Gmail OAuth callback:', error)
                return res.status(500).send(`
                    <html>
                        <head>
                            <title>Authentication Failed</title>
                            <style>
                                body {
                                    font-family: Arial, sans-serif;
                                    text-align: center;
                                    padding-top: 50px;
                                }
                                .container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    padding: 20px;
                                    border: 1px solid #e0e0e0;
                                    border-radius: 5px;
                                }
                                .error {
                                    color: #d32f2f;
                                }
                                .button {
                                    display: inline-block;
                                    background-color: #4CAF50;
                                    color: white;
                                    padding: 10px 20px;
                                    text-decoration: none;
                                    border-radius: 5px;
                                    margin-top: 20px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1 class="error">Authentication Failed</h1>
                                <p>Error: ${getErrorMessage(error)}</p>
                                <p>Please try again or contact support if the issue persists.</p>
                                <button onclick="window.close();" class="button">Close Window</button>
                            </div>
                            <script>
                                setTimeout(() => {
                                    window.close();
                                }, 5000);
                            </script>
                        </body>
                    </html>
                `)
            }
        } else {
            return res.status(400).send(`
                <html>
                    <head>
                        <title>Authentication Failed</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                text-align: center;
                                padding-top: 50px;
                            }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                border: 1px solid #e0e0e0;
                                border-radius: 5px;
                            }
                            .error {
                                color: #d32f2f;
                            }
                            .button {
                                display: inline-block;
                                background-color: #4CAF50;
                                color: white;
                                padding: 10px 20px;
                                text-decoration: none;
                                border-radius: 5px;
                                margin-top: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1 class="error">Authentication Failed</h1>
                            <p>Unsupported provider: ${provider}</p>
                            <p>Please try again with a supported provider.</p>
                            <button onclick="window.close();" class="button">Close Window</button>
                        </div>
                        <script>
                            setTimeout(() => {
                                window.close();
                            }, 5000);
                        </script>
                    </body>
                </html>
            `)
        }
    } catch (error) {
        console.error(`Error in OAuth callback:`, error)
        return res.status(500).send(`
            <html>
                <head>
                    <title>Authentication Failed</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding-top: 50px;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            border: 1px solid #e0e0e0;
                            border-radius: 5px;
                        }
                        .error {
                            color: #d32f2f;
                        }
                        .button {
                            display: inline-block;
                            background-color: #4CAF50;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 5px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="error">Authentication Failed</h1>
                        <p>An unexpected error occurred.</p>
                        <p>Please try again or contact support if the issue persists.</p>
                        <button onclick="window.close();" class="button">Close Window</button>
                    </div>
                    <script>
                        setTimeout(() => {
                            window.close();
                        }, 5000);
                    </script>
                </body>
            </html>
        `)
    }
})

export default router