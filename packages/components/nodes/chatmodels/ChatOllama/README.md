# ChatOllama with Vision Support

This node provides chat completions using Ollama models, including support for image inputs with vision-capable models.

## Vision Capabilities

Many Ollama models support vision capabilities that allow them to process and analyze images. When the "Allow Image Uploads" option is enabled, users can upload images to be processed by the model.

### Models with Vision Support

The following Ollama models are known to support vision capabilities:

1. **llama3.2-vision** - Specifically designed for vision tasks
2. **llava** (and its variants like llava-v1.6) - Specialized multimodal model
3. **bakllava** - A multimodal model based on Mistral 7B
4. **Gemma3** models - Support vision capabilities without "vision" in their name
5. **moondream** - A smaller multimodal model
6. **cogvlm** - A vision language model from THUDM
7. **llama3** models - Many base llama3 models have vision capabilities

This is not an exhaustive list, as Ollama frequently adds new models. Check the [Ollama library](https://ollama.com/library) for the most up-to-date information.

## Usage

1. Enable the "Allow Image Uploads" option in the ChatOllama node
2. Configure a vision-capable Ollama model
3. Use the node in a chatflow with chains or agents
4. When the flow is executed, images can be uploaded through the chat interface

## Example

For a working example of image processing, configure the following:

1. Set the "Model Name" to a vision-capable model (e.g., "llama3.2-vision" or "llava")
2. Enable "Allow Image Uploads"
3. Use in a ConversationChain or equivalent flow

The model will now be able to process uploaded images and respond accordingly.

## References

- [Ollama Vision Models](https://ollama.com/blog/vision-models)
- [Flowise Uploads Documentation](https://docs.flowiseai.com/using-flowise/uploads)