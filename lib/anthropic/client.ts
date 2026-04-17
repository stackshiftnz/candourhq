// SERVER ONLY — never import this in client components

import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key_for_build', // Using a fallback prevents build-time module init errors if ENV is omitted during Vercel build
  timeout: 110_000,
})
