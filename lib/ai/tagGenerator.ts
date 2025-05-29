/**
 * AI-powered tag generation for MCP servers
 * Generates comprehensive, searchable tags for optimal AI agent discovery
 */

interface MCPInfo {
  name: string
  description?: string
  category?: string
  githubContent?: string
  readmeContent?: string
  use_cases?: string[]
}

interface TagGenerationResult {
  tags: string[]
  confidence: number
  reasoning: string
}

/**
 * Generate comprehensive tags for an MCP server using AI analysis
 */
export async function generateMCPTags(mcpInfo: MCPInfo): Promise<TagGenerationResult> {
  const prompt = buildTagGenerationPrompt(mcpInfo)
  
  try {
    // Note: This would integrate with your preferred AI service
    // For now, showing the structure and logic
    const aiResponse = await callAIService(prompt)
    
    return {
      tags: extractTagsFromResponse(aiResponse),
      confidence: calculateConfidence(aiResponse),
      reasoning: extractReasoning(aiResponse)
    }
  } catch (error) {
    console.error('AI tag generation failed:', error)
    
    // Fallback to rule-based generation
    return generateFallbackTags(mcpInfo)
  }
}

/**
 * Build comprehensive prompt for AI tag generation
 */
function buildTagGenerationPrompt(mcpInfo: MCPInfo): string {
  return `You are an expert at generating comprehensive, searchable tags for MCP (Model Context Protocol) servers that AI agents will use to find tools.

AI agents search using natural language like:
- "I need to create GitHub issues"
- "Send messages to my team" 
- "Process credit card payments"
- "Deploy my application"
- "Convert text to speech"

Generate 25-35 comprehensive tags for this MCP server:

**Name:** ${mcpInfo.name}
**Description:** ${mcpInfo.description || 'No description'}
**Category:** ${mcpInfo.category || 'Unknown'}
**Use Cases:** ${mcpInfo.use_cases?.join(', ') || 'None specified'}
**GitHub Content:** ${mcpInfo.githubContent || 'Not available'}

**Tag Categories to Cover:**
1. **Core Identity** (exact name, official status, brand terms)
2. **Action Verbs** (create, send, manage, deploy, process, build, etc.)
3. **Use Case Descriptions** (issue tracking, team communication, payment processing)
4. **Problem-Solution Mapping** (natural language → specific capabilities)
5. **Alternative Terminology** (synonyms, abbreviations, industry terms)
6. **Domain-Specific Terms** (technical jargon users might search for)
7. **Integration Context** (what it works with, platforms, ecosystems)

**Examples of good tag coverage:**
- GitHub: ["github", "git", "repositories", "create issues", "manage issues", "pull requests", "code review", "version control"]
- Slack: ["slack", "messaging", "send messages", "team communication", "chat", "notifications", "workplace communication"]
- Stripe: ["stripe", "payments", "payment processing", "accept payments", "billing", "subscription billing", "e-commerce"]

**Requirements:**
- Include exact name and common variations
- Cover all major use cases and capabilities  
- Include action verbs users might search with
- Add synonyms and alternative terms
- Consider how AI agents might describe their needs
- Include both technical and user-friendly terms
- Ensure comprehensive coverage for natural language search

Generate tags as a JSON array. Focus on terms that AI agents would naturally use when searching for this tool's capabilities.

Response format:
{
  "tags": ["tag1", "tag2", "tag3", ...],
  "reasoning": "Explanation of tag strategy and coverage"
}`
}

/**
 * Fallback rule-based tag generation when AI fails
 */
function generateFallbackTags(mcpInfo: MCPInfo): TagGenerationResult {
  const tags = new Set<string>()
  
  // Core identity tags
  const nameParts = mcpInfo.name.toLowerCase().split(/[\s-_]+/)
  nameParts.forEach(part => tags.add(part))
  
  // Category-based tags
  if (mcpInfo.category) {
    tags.add(mcpInfo.category)
    addCategorySpecificTags(mcpInfo.category, tags)
  }
  
  // Description-based tags
  if (mcpInfo.description) {
    extractKeywordsFromText(mcpInfo.description, tags)
  }
  
  // Use case tags
  if (mcpInfo.use_cases) {
    mcpInfo.use_cases.forEach(useCase => {
      extractKeywordsFromText(useCase, tags)
    })
  }
  
  return {
    tags: Array.from(tags),
    confidence: 0.6, // Lower confidence for fallback
    reasoning: 'Generated using fallback rule-based system due to AI service unavailability'
  }
}

/**
 * Add category-specific tags based on MCP category
 */
function addCategorySpecificTags(category: string, tags: Set<string>) {
  const categoryMappings: Record<string, string[]> = {
    'communication': ['messaging', 'chat', 'notifications', 'team communication'],
    'development': ['coding', 'software development', 'developer tools', 'programming'],
    'productivity': ['task management', 'organization', 'workflow', 'efficiency'],
    'databases': ['data storage', 'data management', 'database operations'],
    'ai-tools': ['artificial intelligence', 'machine learning', 'ai automation'],
    'fintech': ['financial services', 'payments', 'transactions', 'billing']
  }
  
  const categoryTags = categoryMappings[category.toLowerCase()]
  if (categoryTags) {
    categoryTags.forEach(tag => tags.add(tag))
  }
}

/**
 * Extract keywords from text using simple NLP
 */
function extractKeywordsFromText(text: string, tags: Set<string>) {
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'])
  
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))
  
  words.forEach(word => tags.add(word))
}

/**
 * AI service call using configured providers
 */
async function callAIService(prompt: string): Promise<string> {
  try {
    // Import here to avoid circular dependency
    const { callAIServiceWithProviders } = await import('./providers')
    return await callAIServiceWithProviders(prompt)
  } catch (error) {
    console.error('AI service error:', error)
    throw new Error('AI service unavailable. Please configure OpenAI, Anthropic, or Local LLM.')
  }
}

/**
 * Extract tags from AI response
 */
function extractTagsFromResponse(response: string): string[] {
  try {
    const parsed = JSON.parse(response)
    return parsed.tags || []
  } catch (error) {
    // Fallback: extract tags from text response
    const tagMatches = response.match(/\["([^"]+)"(?:,\s*"([^"]+)")*/g)
    if (tagMatches) {
      return tagMatches[0]
        .replace(/[\[\]"]/g, '')
        .split(',')
        .map(tag => tag.trim())
    }
    return []
  }
}

/**
 * Calculate confidence score from AI response
 */
function calculateConfidence(response: string): number {
  try {
    const parsed = JSON.parse(response)
    return parsed.confidence || 0.8
  } catch (error) {
    return 0.7 // Default confidence for text responses
  }
}

/**
 * Extract reasoning from AI response
 */
function extractReasoning(response: string): string {
  try {
    const parsed = JSON.parse(response)
    return parsed.reasoning || 'AI-generated tags based on MCP analysis'
  } catch (error) {
    return 'AI-generated tags with text parsing fallback'
  }
}

/**
 * Enhanced tag generation that includes GitHub content analysis
 */
export async function generateMCPTagsWithGitHub(
  mcpInfo: MCPInfo,
  githubReadme?: string,
  githubDescription?: string
): Promise<TagGenerationResult> {
  const enhancedInfo = {
    ...mcpInfo,
    githubContent: githubDescription,
    readmeContent: githubReadme
  }
  
  return generateMCPTags(enhancedInfo)
}

/**
 * Validate and clean generated tags
 */
export function validateAndCleanTags(tags: string[]): string[] {
  return tags
    .map(tag => tag.toLowerCase().trim())
    .filter(tag => 
      tag.length > 1 && 
      tag.length < 50 && 
      /^[a-z0-9\s-_]+$/.test(tag)
    )
    .slice(0, 40) // Limit to 40 tags maximum
}

export type { MCPInfo, TagGenerationResult }