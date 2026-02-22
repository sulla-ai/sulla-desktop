# Setting Up API Keys

This page covers the core setup flow for remote model API keys in Sulla Desktop.

## What this page is for

In Sulla, API keys are used to connect to remote model providers.

You must add a valid API key before Sulla can load and show that provider's available models.

## Configure your key in Sulla

Use this path in the app:

1. Open the main Electron menu.
2. Open **Language Model Settings**.
3. Go to **Models**.
4. Open **Remote Models**.
5. Select your provider.
6. Paste your API key.
7. Save.

After saving, Sulla will load the model list for that provider.

## Provider-specific key setup guides

Use the guides below to generate keys from each provider:

- [Grok (xAI) API Key Setup](./remote_models/grok-xai.md)
- [OpenAI API Key Setup](./remote_models/openai.md)
- [Anthropic API Key Setup](./remote_models/anthropic.md)
- [Google Gemini API Key Setup](./remote_models/google-gemini.md)

## Key management notes

- Keep your API keys private.
- Rotate/revoke keys in the provider dashboard if a key is exposed.
- Use separate keys per environment when possible.
