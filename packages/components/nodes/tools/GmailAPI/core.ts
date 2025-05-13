import { Tool, StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

// Gmail API Tool to read emails
export class GmailReadTool extends StructuredTool {
    name = 'gmail_read'
    description = 'Use this tool to read, search, and retrieve emails from Gmail.'
    gmailClient: gmail_v1.Gmail
    maxResults: number

    constructor(gmailClient: gmail_v1.Gmail, maxResults: number = 10) {
        super()
        this.gmailClient = gmailClient
        this.maxResults = maxResults
    }

    schema = z.object({
        query: z.string().optional().describe('Search query to filter emails (e.g., "from:example@gmail.com", "subject:meeting")'),
        labelIds: z.array(z.string()).optional().describe('Array of label IDs to filter by (e.g., ["INBOX", "UNREAD"])'),
        maxResults: z.number().optional().describe('Maximum number of emails to return'),
        includeAttachments: z.boolean().optional().default(false).describe('Whether to include attachment information')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { query, labelIds, maxResults = this.maxResults, includeAttachments = false } = input

            // List emails matching the criteria
            const response = await this.gmailClient.users.messages.list({
                userId: 'me',
                q: query,
                labelIds: labelIds,
                maxResults: maxResults
            })

            if (!response.data.messages || response.data.messages.length === 0) {
                return 'No emails found matching the criteria.'
            }

            // Get details for each email
            const emails = []
            for (const message of response.data.messages) {
                const emailDetails = await this.gmailClient.users.messages.get({
                    userId: 'me',
                    id: message.id as string,
                    format: 'full'
                })

                const headers = emailDetails.data.payload?.headers || []
                const subject = headers.find(header => header.name === 'Subject')?.value || 'No Subject'
                const from = headers.find(header => header.name === 'From')?.value || 'Unknown Sender'
                const to = headers.find(header => header.name === 'To')?.value || 'Unknown Recipient'
                const date = headers.find(header => header.name === 'Date')?.value || 'Unknown Date'

                // Get body content
                let body = ''
                if (emailDetails.data.payload?.body?.data) {
                    // If body is directly in the payload
                    body = decodeBase64Url(emailDetails.data.payload.body.data)
                } else if (emailDetails.data.payload?.parts) {
                    // If body is in parts (multipart email)
                    for (const part of emailDetails.data.payload.parts) {
                        if (part.mimeType === 'text/plain' && part.body?.data) {
                            body = decodeBase64Url(part.body.data)
                            break
                        } else if (part.mimeType === 'text/html' && part.body?.data && body === '') {
                            // Fallback to HTML if no plain text
                            body = decodeBase64Url(part.body.data)
                        }
                    }
                }

                // Get attachments if requested
                const attachments = []
                if (includeAttachments && emailDetails.data.payload?.parts) {
                    for (const part of emailDetails.data.payload.parts) {
                        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
                            attachments.push({
                                filename: part.filename,
                                mimeType: part.mimeType,
                                size: part.body.size,
                                attachmentId: part.body.attachmentId
                            })
                        }
                    }
                }

                // Build email object
                const email = {
                    id: message.id,
                    threadId: message.threadId,
                    labelIds: emailDetails.data.labelIds,
                    snippet: emailDetails.data.snippet,
                    subject,
                    from,
                    to,
                    date,
                    body,
                    attachments: attachments.length > 0 ? attachments : undefined
                }

                emails.push(email)
            }

            return JSON.stringify(emails, null, 2)
        } catch (error) {
            return `Error reading emails: ${error}`
        }
    }
}

// Gmail API Tool to send emails
export class GmailSendTool extends StructuredTool {
    name = 'gmail_send'
    description = 'Use this tool to compose and send emails through Gmail.'
    gmailClient: gmail_v1.Gmail

    constructor(gmailClient: gmail_v1.Gmail) {
        super()
        this.gmailClient = gmailClient
    }

    schema = z.object({
        to: z.string().describe('Email recipient(s), separated by commas'),
        subject: z.string().describe('Subject of the email'),
        body: z.string().describe('Body/content of the email'),
        cc: z.string().optional().describe('CC recipient(s), separated by commas'),
        bcc: z.string().optional().describe('BCC recipient(s), separated by commas'),
        attachments: z.array(z.object({
            filename: z.string(),
            content: z.string().describe('Base64 encoded content')
        })).optional().describe('Files to attach to the email'),
        isHtml: z.boolean().optional().default(true).describe('Whether the body is HTML formatted')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { to, subject, body, cc, bcc, attachments, isHtml = true } = input

            // Get user profile to determine email address
            const profile = await this.gmailClient.users.getProfile({ userId: 'me' })
            const fromEmail = profile.data.emailAddress

            // Create email parts
            const messageParts = []

            // Add headers
            messageParts.push(`From: ${fromEmail}`)
            messageParts.push(`To: ${to}`)
            if (cc) messageParts.push(`Cc: ${cc}`)
            if (bcc) messageParts.push(`Bcc: ${bcc}`)
            messageParts.push(`Subject: ${subject}`)

            // Set content type
            const contentType = isHtml ? 'text/html' : 'text/plain'

            // Create email without attachments
            if (!attachments || attachments.length === 0) {
                messageParts.push(`Content-Type: ${contentType}; charset=utf-8`)
                messageParts.push('')
                messageParts.push(body)

                const email = messageParts.join('\r\n')
                const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

                // Send the email
                const response = await this.gmailClient.users.messages.send({
                    userId: 'me',
                    requestBody: {
                        raw: encodedEmail
                    }
                })

                return `Email sent successfully. Message ID: ${response.data.id}`
            } else {
                // Create multipart email with attachments
                const boundary = `boundary_${Date.now().toString()}`
                messageParts.push(`MIME-Version: 1.0`)
                messageParts.push(`Content-Type: multipart/mixed; boundary=${boundary}`)
                messageParts.push('')

                // Add the body part
                messageParts.push(`--${boundary}`)
                messageParts.push(`Content-Type: ${contentType}; charset=utf-8`)
                messageParts.push('')
                messageParts.push(body)

                // Add each attachment
                for (const attachment of attachments) {
                    messageParts.push(`--${boundary}`)
                    messageParts.push(`Content-Type: application/octet-stream`)
                    messageParts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
                    messageParts.push(`Content-Transfer-Encoding: base64`)
                    messageParts.push('')
                    messageParts.push(attachment.content)
                }

                // End the multipart message
                messageParts.push(`--${boundary}--`)

                const email = messageParts.join('\r\n')
                const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

                // Send the email
                const response = await this.gmailClient.users.messages.send({
                    userId: 'me',
                    requestBody: {
                        raw: encodedEmail
                    }
                })

                return `Email sent successfully with ${attachments.length} attachment(s). Message ID: ${response.data.id}`
            }
        } catch (error) {
            return `Error sending email: ${error}`
        }
    }
}

// Gmail API Tool to create and manage drafts
export class GmailDraftTool extends StructuredTool {
    name = 'gmail_draft'
    description = 'Use this tool to create, update, delete, and send draft emails in Gmail.'
    gmailClient: gmail_v1.Gmail

    constructor(gmailClient: gmail_v1.Gmail) {
        super()
        this.gmailClient = gmailClient
    }

    schema = z.object({
        action: z.enum(['create', 'update', 'delete', 'send', 'list']).describe('Action to perform with drafts'),
        draftId: z.string().optional().describe('ID of existing draft (required for update/delete/send)'),
        to: z.string().optional().describe('Email recipient(s), separated by commas (for create/update)'),
        subject: z.string().optional().describe('Subject of the email (for create/update)'),
        body: z.string().optional().describe('Body/content of the email (for create/update)'),
        cc: z.string().optional().describe('CC recipient(s), separated by commas (for create/update)'),
        bcc: z.string().optional().describe('BCC recipient(s), separated by commas (for create/update)'),
        isHtml: z.boolean().optional().default(true).describe('Whether the body is HTML formatted')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, draftId, to, subject, body, cc, bcc, isHtml = true } = input

            // Check for required parameters based on action
            if (['update', 'delete', 'send'].includes(action) && !draftId) {
                return `Error: draftId is required for ${action} action`
            }

            if (['create', 'update'].includes(action) && (!to || !subject || !body)) {
                return `Error: to, subject, and body are required for ${action} action`
            }

            // Get user profile
            const profile = await this.gmailClient.users.getProfile({ userId: 'me' })
            const fromEmail = profile.data.emailAddress

            // Handle different actions
            switch (action) {
                case 'list': {
                    // List all drafts
                    const response = await this.gmailClient.users.drafts.list({ userId: 'me' })

                    if (!response.data.drafts || response.data.drafts.length === 0) {
                        return 'No drafts found.'
                    }

                    // Get details for each draft
                    const drafts = []
                    for (const draft of response.data.drafts) {
                        const draftDetails = await this.gmailClient.users.drafts.get({
                            userId: 'me',
                            id: draft.id as string
                        })

                        const headers = draftDetails.data.message?.payload?.headers || []
                        const subject = headers.find(header => header.name === 'Subject')?.value || 'No Subject'
                        const to = headers.find(header => header.name === 'To')?.value || 'Unknown Recipient'

                        drafts.push({
                            id: draft.id,
                            messageId: draft.message?.id,
                            subject: subject,
                            to: to,
                            snippet: draftDetails.data.message?.snippet
                        })
                    }

                    return JSON.stringify(drafts, null, 2)
                }

                case 'create': {
                    // Create a new draft
                    // Create email parts
                    const messageParts = []

                    // Add headers
                    messageParts.push(`From: ${fromEmail}`)
                    messageParts.push(`To: ${to}`)
                    if (cc) messageParts.push(`Cc: ${cc}`)
                    if (bcc) messageParts.push(`Bcc: ${bcc}`)
                    messageParts.push(`Subject: ${subject}`)

                    // Set content type
                    const contentType = isHtml ? 'text/html' : 'text/plain'
                    messageParts.push(`Content-Type: ${contentType}; charset=utf-8`)
                    messageParts.push('')
                    messageParts.push(body)

                    const email = messageParts.join('\r\n')
                    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

                    // Create the draft
                    const response = await this.gmailClient.users.drafts.create({
                        userId: 'me',
                        requestBody: {
                            message: {
                                raw: encodedEmail
                            }
                        }
                    })

                    return `Draft created successfully. Draft ID: ${response.data.id}`
                }

                case 'update': {
                    // Delete existing draft and create new one (Gmail API doesn't support direct updates)
                    // First, delete the existing draft
                    await this.gmailClient.users.drafts.delete({
                        userId: 'me',
                        id: draftId as string
                    })

                    // Then create a new draft with the updated content
                    const messageParts = []

                    // Add headers
                    messageParts.push(`From: ${fromEmail}`)
                    messageParts.push(`To: ${to}`)
                    if (cc) messageParts.push(`Cc: ${cc}`)
                    if (bcc) messageParts.push(`Bcc: ${bcc}`)
                    messageParts.push(`Subject: ${subject}`)

                    // Set content type
                    const contentType = isHtml ? 'text/html' : 'text/plain'
                    messageParts.push(`Content-Type: ${contentType}; charset=utf-8`)
                    messageParts.push('')
                    messageParts.push(body)

                    const email = messageParts.join('\r\n')
                    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

                    // Create the draft
                    const response = await this.gmailClient.users.drafts.create({
                        userId: 'me',
                        requestBody: {
                            message: {
                                raw: encodedEmail
                            }
                        }
                    })

                    return `Draft updated successfully. New Draft ID: ${response.data.id}`
                }

                case 'delete': {
                    // Delete a draft
                    await this.gmailClient.users.drafts.delete({
                        userId: 'me',
                        id: draftId as string
                    })

                    return `Draft deleted successfully. Draft ID: ${draftId}`
                }

                case 'send': {
                    // Send a draft
                    const response = await this.gmailClient.users.drafts.send({
                        userId: 'me',
                        requestBody: {
                            id: draftId
                        }
                    })

                    return `Draft sent successfully. Message ID: ${response.data.id}`
                }

                default:
                    return `Error: Unsupported action: ${action}`
            }
        } catch (error) {
            return `Error managing draft: ${error}`
        }
    }
}

// Gmail API Tool to manage labels
export class GmailLabelTool extends StructuredTool {
    name = 'gmail_label'
    description = 'Use this tool to create, list, update, or delete Gmail labels, and apply labels to emails.'
    gmailClient: gmail_v1.Gmail

    constructor(gmailClient: gmail_v1.Gmail) {
        super()
        this.gmailClient = gmailClient
    }

    schema = z.object({
        action: z.enum(['create', 'list', 'update', 'delete', 'apply']).describe('Action to perform with labels'),
        name: z.string().optional().describe('Name of the label (for create/update)'),
        labelId: z.string().optional().describe('ID of existing label (for update/delete)'),
        messageId: z.string().optional().describe('ID of message to label (for apply)'),
        labelIds: z.array(z.string()).optional().describe('Array of label IDs to apply to message (for apply)'),
        color: z.object({
            textColor: z.string().optional(),
            backgroundColor: z.string().optional()
        }).optional().describe('Color settings for the label (for create/update)')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, name, labelId, messageId, labelIds, color } = input

            // Check for required parameters based on action
            if (['update', 'delete'].includes(action) && !labelId) {
                return `Error: labelId is required for ${action} action`
            }

            if (['create', 'update'].includes(action) && !name) {
                return `Error: name is required for ${action} action`
            }

            if (action === 'apply' && (!messageId || !labelIds || labelIds.length === 0)) {
                return 'Error: messageId and labelIds are required for apply action'
            }

            // Handle different actions
            switch (action) {
                case 'list': {
                    // List all labels
                    const response = await this.gmailClient.users.labels.list({ userId: 'me' })

                    if (!response.data.labels || response.data.labels.length === 0) {
                        return 'No labels found.'
                    }

                    // Format the response
                    const labels = response.data.labels.map(label => ({
                        id: label.id,
                        name: label.name,
                        type: label.type,
                        messagesTotal: label.messagesTotal,
                        messagesUnread: label.messagesUnread,
                        color: label.color
                    }))

                    return JSON.stringify(labels, null, 2)
                }

                case 'create': {
                    // Create a new label
                    const response = await this.gmailClient.users.labels.create({
                        userId: 'me',
                        requestBody: {
                            name: name,
                            labelListVisibility: 'labelShow',
                            messageListVisibility: 'show',
                            color: color
                        }
                    })

                    return `Label created successfully. Label ID: ${response.data.id}`
                }

                case 'update': {
                    // Get current label to preserve existing values
                    const currentLabel = await this.gmailClient.users.labels.get({
                        userId: 'me',
                        id: labelId as string
                    })

                    // Update the label
                    const response = await this.gmailClient.users.labels.update({
                        userId: 'me',
                        id: labelId as string,
                        requestBody: {
                            id: labelId,
                            name: name,
                            labelListVisibility: currentLabel.data.labelListVisibility,
                            messageListVisibility: currentLabel.data.messageListVisibility,
                            color: color || currentLabel.data.color
                        }
                    })

                    return `Label updated successfully. Label ID: ${response.data.id}`
                }

                case 'delete': {
                    // Delete a label
                    await this.gmailClient.users.labels.delete({
                        userId: 'me',
                        id: labelId as string
                    })

                    return `Label deleted successfully. Label ID: ${labelId}`
                }

                case 'apply': {
                    // Apply labels to a message
                    const response = await this.gmailClient.users.messages.modify({
                        userId: 'me',
                        id: messageId as string,
                        requestBody: {
                            addLabelIds: labelIds
                        }
                    })

                    return `Labels applied successfully to message ID: ${response.data.id}`
                }

                default:
                    return `Error: Unsupported action: ${action}`
            }
        } catch (error) {
            return `Error managing labels: ${error}`
        }
    }
}

// Gmail API Tool to manage emails (archive, delete, etc.)
export class GmailManageTool extends StructuredTool {
    name = 'gmail_manage'
    description = 'Use this tool to archive, delete, mark as read/unread, or move emails in Gmail.'
    gmailClient: gmail_v1.Gmail

    constructor(gmailClient: gmail_v1.Gmail) {
        super()
        this.gmailClient = gmailClient
    }

    schema = z.object({
        action: z.enum(['archive', 'delete', 'markRead', 'markUnread', 'move', 'trash', 'untrash', 'star', 'unstar']).describe('Action to perform on emails'),
        messageIds: z.array(z.string()).describe('Array of message IDs to perform action on'),
        destinationLabelId: z.string().optional().describe('Destination label ID (for move action)')
    })

    async _call(input: z.infer<typeof this.schema>) {
        try {
            const { action, messageIds, destinationLabelId } = input

            // Check for required parameters
            if (!messageIds || messageIds.length === 0) {
                return 'Error: messageIds are required'
            }

            if (action === 'move' && !destinationLabelId) {
                return 'Error: destinationLabelId is required for move action'
            }

            // Process each message
            const results = []

            for (const messageId of messageIds) {
                try {
                    let response

                    switch (action) {
                        case 'archive':
                            // Remove from INBOX (archive)
                            response = await this.gmailClient.users.messages.modify({
                                userId: 'me',
                                id: messageId,
                                requestBody: {
                                    removeLabelIds: ['INBOX']
                                }
                            })
                            results.push(`Message ${messageId} archived successfully`)
                            break

                        case 'delete':
                            // Permanently delete message
                            await this.gmailClient.users.messages.delete({
                                userId: 'me',
                                id: messageId
                            })
                            results.push(`Message ${messageId} deleted permanently`)
                            break

                        case 'markRead':
                            // Mark as read (remove UNREAD label)
                            response = await this.gmailClient.users.messages.modify({
                                userId: 'me',
                                id: messageId,
                                requestBody: {
                                    removeLabelIds: ['UNREAD']
                                }
                            })
                            results.push(`Message ${messageId} marked as read`)
                            break

                        case 'markUnread':
                            // Mark as unread (add UNREAD label)
                            response = await this.gmailClient.users.messages.modify({
                                userId: 'me',
                                id: messageId,
                                requestBody: {
                                    addLabelIds: ['UNREAD']
                                }
                            })
                            results.push(`Message ${messageId} marked as unread`)
                            break

                        case 'move':
                            // Move to a different label
                            // First, get current labels
                            const messageDetails = await this.gmailClient.users.messages.get({
                                userId: 'me',
                                id: messageId,
                                format: 'minimal'
                            })

                            // Remove all current labels except system ones
                            const currentLabels = messageDetails.data.labelIds || []
                            const systemLabels = ['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT']
                            const removeLabels = currentLabels.filter(label => !systemLabels.includes(label))

                            // Apply new label
                            response = await this.gmailClient.users.messages.modify({
                                userId: 'me',
                                id: messageId,
                                requestBody: {
                                    addLabelIds: [destinationLabelId as string],
                                    removeLabelIds: removeLabels
                                }
                            })
                            results.push(`Message ${messageId} moved to label ${destinationLabelId}`)
                            break

                        case 'trash':
                            // Move to trash
                            response = await this.gmailClient.users.messages.trash({
                                userId: 'me',
                                id: messageId
                            })
                            results.push(`Message ${messageId} moved to trash`)
                            break

                        case 'untrash':
                            // Remove from trash
                            response = await this.gmailClient.users.messages.untrash({
                                userId: 'me',
                                id: messageId
                            })
                            results.push(`Message ${messageId} removed from trash`)
                            break

                        case 'star':
                            // Star the message (add STARRED label)
                            response = await this.gmailClient.users.messages.modify({
                                userId: 'me',
                                id: messageId,
                                requestBody: {
                                    addLabelIds: ['STARRED']
                                }
                            })
                            results.push(`Message ${messageId} starred`)
                            break

                        case 'unstar':
                            // Unstar the message (remove STARRED label)
                            response = await this.gmailClient.users.messages.modify({
                                userId: 'me',
                                id: messageId,
                                requestBody: {
                                    removeLabelIds: ['STARRED']
                                }
                            })
                            results.push(`Message ${messageId} unstarred`)
                            break

                        default:
                            results.push(`Error: Unsupported action ${action} for message ${messageId}`)
                    }
                } catch (error) {
                    results.push(`Error processing message ${messageId}: ${error}`)
                }
            }

            return results.join('\n')
        } catch (error) {
            return `Error managing emails: ${error}`
        }
    }
}

// Helper function to create Gmail client
export async function createGmailClient(credentials: any, token: any): Promise<gmail_v1.Gmail> {
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

    const gmailClient = google.gmail({
        version: 'v1',
        auth: oAuth2Client as any
    })

    return gmailClient
}

// Helper function to encode email to base64
export function encodeEmail(message: {
    to: string;
    from?: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
}): string {
    let emailLines = []
    
    emailLines.push(`To: ${message.to}`)
    if (message.from) emailLines.push(`From: ${message.from}`)
    if (message.cc) emailLines.push(`Cc: ${message.cc}`)
    if (message.bcc) emailLines.push(`Bcc: ${message.bcc}`)
    emailLines.push(`Subject: ${message.subject}`)
    emailLines.push('Content-Type: text/html; charset=utf-8')
    emailLines.push('')
    emailLines.push(message.body)
    
    return Buffer.from(emailLines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Helper function to decode base64url to text
export function decodeBase64Url(input: string): string {
    // Replace non-url compatible chars with base64 standard chars
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    
    // Add padding if needed
    while (base64.length % 4) {
        base64 += '='
    }
    
    return Buffer.from(base64, 'base64').toString('utf8')
}