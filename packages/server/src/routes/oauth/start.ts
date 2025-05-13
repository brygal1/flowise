import express, { Request, Response } from 'express'
import { OAuthProviderRegistry } from '../../utils/OAuthProviderRegistry'
import { getCredentialData, getCredentialParam } from '../../utils/oauthUtils'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

const router = express.Router()
const oauthRegistry = OAuthProviderRegistry.getInstance()

/**
 * Start OAuth flow for a specific provider
 * @route POST /api/v1/oauth/start/:provider
 */
router.post('/:provider', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params
        const { nodeData, nodeId, credentialId, credentialData } = req.body

        if (!provider) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'OAuth provider is required')
        }

        console.log(`Starting OAuth flow for provider: ${provider}`)

        // Get the OAuth provider
        if (!oauthRegistry.hasProvider(provider)) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `OAuth provider not found: ${provider}`)
        }

        const oauthProvider = oauthRegistry.getProvider(provider)
        console.log(`Using OAuth provider: ${oauthProvider.displayName}`)

        // Prepare the data needed for starting OAuth
        const nodeDataWithCredential = {
            ...nodeData,
            credential: credentialId || 'new',
            id: nodeId,
            // Ensure inputs is initialized
            inputs: nodeData?.inputs || {}
        }

        // Start the OAuth flow
        const options: any = {}
        
        // Ensure we have proper credential data for the OAuth provider
        if (credentialData) {
            console.log('Using credential data from request:', JSON.stringify({
                hasClientId: !!credentialData.clientId,
                hasClientSecret: !!credentialData.clientSecret,
                hasRedirectUri: !!credentialData.redirectUri
            }))
            options.credentialData = credentialData
        }

        const result = await oauthProvider.startOAuth(nodeDataWithCredential, options)

        return res.json(result)
    } catch (error) {
        console.error('Error starting OAuth flow:', error)

        // Get the error message and add more context for common errors
        let errorMessage = getErrorMessage(error)

        if (errorMessage.includes('invalid_client')) {
            errorMessage = 'Invalid client credentials. Please verify your Client ID and Client Secret are correct.'
        } else if (errorMessage.includes('redirect_uri_mismatch')) {
            errorMessage = 'Redirect URI mismatch. Please ensure the redirect URI matches what is configured in the OAuth provider settings.'
        }

        res.status(error instanceof InternalFlowiseError ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR).send({
            message: errorMessage || 'Failed to start OAuth flow',
            details: error instanceof Error ? error.stack : undefined
        })
    }
})

export default router