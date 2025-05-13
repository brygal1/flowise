import express, { Request, Response } from 'express'
import credentialsController from '../../controllers/credentials'
import credentialsService from '../../services/credentials'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
const router = express.Router()

// CREATE
router.post('/', credentialsController.createCredential)

// READ
router.get('/', credentialsController.getAllCredentials)
router.get(['/', '/:id'], credentialsController.getCredentialById)

// UPDATE
router.put(['/', '/:id'], credentialsController.updateCredential)

// DELETE
router.delete(['/', '/:id'], credentialsController.deleteCredentials)

/**
 * @route POST /api/v1/credentials/startauth
 * @description Start OAuth authentication process
 */
router.post('/startauth', async (req: Request, res: Response) => {
    try {
        console.log('Starting OAuth authentication process for credential')
        const appServer = getRunningExpressApp()

        const { credentialId, credentialName, credentialData } = req.body

        console.log(`Received startauth request for credentialName: ${credentialName}, credentialId: ${credentialId || 'new credential'}`)
        console.log('Credential data received:', JSON.stringify({
            hasClientId: !!credentialData?.clientId,
            hasClientSecret: !!credentialData?.clientSecret,
            redirectUri: credentialData?.redirectUri
        }))

        // For new credentials, credentialId may not be required
        // if (!credentialId) {
        //     throw new Error('Missing required credential ID')
        // }

        if (!credentialName) {
            throw new Error('Missing credential name')
        }

        // Find the credential class in the components
        const credentialClassInstance = appServer.nodesPool.componentCredentials[credentialName]

        if (!credentialClassInstance) {
            console.error(`Credential type ${credentialName} not found in available credentials:`,
                Object.keys(appServer.nodesPool.componentCredentials).join(', '))
            throw new Error(`Credential type ${credentialName} not found`)
        }

        // Type assertion to access startAuth method
        const credentialWithAuth = credentialClassInstance as any

        if (!credentialWithAuth.startAuth) {
            throw new Error(`Credential ${credentialName} does not support OAuth authentication`)
        }

        // Validate credential data
        if (!credentialData) {
            throw new Error('Missing credential data')
        }

        if (!credentialData.clientId) {
            throw new Error('Client ID is required for authentication')
        }

        if (!credentialData.clientSecret) {
            throw new Error('Client Secret is required for authentication')
        }

        // Call startAuth method
        console.log('Calling startAuth method on credential class')
        const result = await credentialWithAuth.startAuth(credentialData, { credentialId })

        console.log('Authentication URL generated successfully')
        return res.json(result)
    } catch (error) {
        console.error('Error starting OAuth authentication:', error)

        // Get the error message and add more context for common errors
        let errorMessage = (error as Error).message

        if (errorMessage.includes('invalid_client')) {
            errorMessage = 'Invalid client credentials. Please verify your Client ID and Client Secret are correct.'
        } else if (errorMessage.includes('redirect_uri_mismatch')) {
            errorMessage = 'Redirect URI mismatch. Please ensure the redirect URI matches one configured in Google Cloud Console.'
        } else if (errorMessage.includes('Missing Client ID') || errorMessage.includes('Client ID is required')) {
            errorMessage = 'Client ID is required. Please enter a valid Google OAuth Client ID.'
        } else if (errorMessage.includes('Missing Client Secret') || errorMessage.includes('Client Secret is required')) {
            errorMessage = 'Client Secret is required. Please enter a valid Google OAuth Client Secret.'
        }

        res.status(500).send({
            message: errorMessage || 'Failed to start authentication process',
            details: error instanceof Error ? error.stack : undefined
        })
    }
})

export default router
