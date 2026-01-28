<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1QHbQSMfc9OvpXmfRP6L0dxottcjNSzcf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set environment variables in your `.env.local` file:
   - `GEMINI_API_KEY` - Your Gemini API key (required for text generation and default image generation)
   - `FAL_KEY` - Your fal.ai API key (optional, required for FLUX.2, Seedream 4.5, and Recraft v3 models)
3. Run the app:
   `npm run dev`

## Image Generation Models

The app supports multiple image generation models:

| Model | Provider | Description |
|-------|----------|-------------|
| Default (Gemini) | Google | Default image generation using Gemini API |
| FLUX.2 [dev] | fal.ai | High-quality, fast generation with excellent text rendering |
| Seedream 4.5 | fal.ai (ByteDance) | Excellent detail preservation and multi-reference support |
| Recraft v3 | fal.ai | Top-ranked model, excellent for brand-consistent imagery |

To use FLUX.2, Seedream 4.5, or Recraft v3, you need to:
1. Create an account at [fal.ai](https://fal.ai)
2. Get your API key from the [fal.ai dashboard](https://fal.ai/dashboard/keys)
3. Add `FAL_KEY=your_api_key_here` to your environment variables
