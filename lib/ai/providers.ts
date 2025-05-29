/**
 * AI Provider integrations for tag generation
 * Supports multiple AI services with fallback options
 */

interface AIProvider {
  name: string
  generateTags(prompt: string): Promise<string>
  isAvailable(): Promise<boolean>
}

/**
 * OpenAI GPT integration for tag generation
 */
export class OpenAIProvider implements AIProvider {
  name = 'OpenAI'
  private apiKey: string
  private model: string

  constructor(apiKey?: string, model = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    this.model = model
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  async generateTags(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at generating comprehensive, searchable tags for MCP servers that AI agents will use. Always respond with valid JSON containing tags and reasoning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }
}

/**
 * Anthropic Claude integration for tag generation
 */
export class AnthropicProvider implements AIProvider {
  name = 'Anthropic'
  private apiKey: string
  private model: string

  constructor(apiKey?: string, model = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || ''
    this.model = model
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey)
  }

  async generateTags(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.content[0]?.text || ''
  }
}

/**
 * Local LLM integration (e.g., Ollama, LM Studio)
 */
export class LocalLLMProvider implements AIProvider {
  name = 'Local LLM'
  private baseUrl: string
  private model: string

  constructor(baseUrl?: string, model = 'llama2') {
    this.baseUrl = baseUrl || process.env.LOCAL_LLM_URL || 'http://localhost:11434'
    this.model = model
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  async generateTags(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Local LLM error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.response || ''
  }
}

/**
 * AI Provider Factory with automatic fallback
 */
export class AIProviderFactory {
  private providers: AIProvider[]

  constructor() {
    this.providers = [
      new OpenAIProvider(),
      new AnthropicProvider(),
      new LocalLLMProvider()
    ]
  }

  async getAvailableProvider(): Promise<AIProvider | null> {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          console.log(`Using AI provider: ${provider.name}`)
          return provider
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} unavailable:`, error)
      }
    }
    return null
  }

  async generateTags(prompt: string): Promise<string> {
    const provider = await this.getAvailableProvider()
    
    if (!provider) {
      throw new Error('No AI providers available. Please configure OpenAI, Anthropic, or Local LLM.')
    }

    return provider.generateTags(prompt)
  }
}

// Default export for easy usage
export const aiProvider = new AIProviderFactory()

/**
 * Update the tag generator to use AI providers
 */
export async function callAIServiceWithProviders(prompt: string): Promise<string> {
  return aiProvider.generateTags(prompt)
}