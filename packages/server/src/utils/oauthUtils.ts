import { ICommonObject } from 'flowise-components'
import { Credential } from '../database/entities/Credential'
import credentialsService from '../services/credentials'
import { decryptCredentialData } from './index'

/**
 * Utility functions to support the OAuth system
 */

/**
 * Get credential data from database and decrypt it
 */
export const getCredentialData = async (credentialId: string, options?: ICommonObject): Promise<ICommonObject> => {
    try {
        // Return empty object if credentialId is 'new'
        if (credentialId === 'new') return {}

        // Get credential from database
        const credential = await credentialsService.getCredentialById(credentialId)
        if (!credential) {
            throw new Error(`Credential with id ${credentialId} not found`)
        }

        // Decrypt the credential data
        return decryptCredentialData(credential.encryptedData)
    } catch (error) {
        console.error('Error getting credential data:', error)
        return {}
    }
}

/**
 * Get specific credential parameter
 */
export const getCredentialParam = (
    paramName: string, 
    credentialData: ICommonObject, 
    nodeData: ICommonObject,
    options?: ICommonObject
): string => {
    // First check in options.credentialData if provided
    if (options?.credentialData && options.credentialData[paramName]) {
        return options.credentialData[paramName] as string
    }
    
    // Then check in nodeData inputs (user might have provided value there)
    if (nodeData.inputs && nodeData.inputs[paramName]) {
        return nodeData.inputs[paramName] as string
    }
    
    // Finally check in credential data
    if (credentialData && credentialData[paramName]) {
        return credentialData[paramName] as string
    }
    
    return ''
}