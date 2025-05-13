import { ChatOllama as LCChatOllama, ChatOllamaInput } from '@langchain/ollama'
import { IMultiModalOption, IVisionChatModal } from '../../../src'

export class ChatOllama extends LCChatOllama implements IVisionChatModal {
    configuredModel: string
    configuredMaxToken?: number
    multiModalOption: IMultiModalOption
    id: string

    constructor(id: string, fields?: ChatOllamaInput) {
        super(fields)
        this.id = id
        this.configuredModel = fields?.model ?? ''
    }

    revertToOriginalModel(): void {
        this.model = this.configuredModel
    }

    setMultiModalOption(multiModalOption: IMultiModalOption): void {
        this.multiModalOption = multiModalOption
    }

    setVisionModel(): void {
        // For Ollama, vision capability is inherent in the model itself
        // Many models support vision without indicating it in their names (e.g., Gemma3, some llama models)
        // We don't need to change the model name as it's the user's responsibility to select a vision-capable model
        
        // We don't attempt to detect vision capabilities by name, as many models like Gemma3 support vision
        // but don't have "vision" in their name. The user should know which models support image input.
        console.log(`Using model "${this.model}" with image processing enabled. Ensure this model supports vision capabilities.`)
    }
}
