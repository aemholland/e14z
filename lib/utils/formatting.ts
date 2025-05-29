/**
 * Formatting utilities for consistent text display
 * Handles proper capitalization, acronyms, and title case
 */

/**
 * List of acronyms that should always be uppercase
 */
const ACRONYMS = [
  'API', 'URL', 'ID', 'UI', 'UX', 'AI', 'ML', 'CI', 'CD', 'AWS', 'GCP', 
  'HTTP', 'HTTPS', 'JSON', 'XML', 'SQL', 'JWT', 'OAuth', 'SDK', 'REST',
  'GraphQL', 'TCP', 'UDP', 'DNS', 'SSL', 'TLS', 'SSH', 'FTP', 'SMTP',
  'POP', 'IMAP', 'HTML', 'CSS', 'JS', 'TS', 'PHP', 'npm', 'CLI', 'GUI',
  'YAML', 'CSV', 'PDF', 'PNG', 'JPG', 'GIF', 'SVG', 'MCP', 'RBAC'
]

/**
 * Words that should be lowercase (unless at start of sentence)
 */
const LOWERCASE_WORDS = [
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 
  'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'with', 'from'
]

/**
 * Convert string to proper title case with acronym handling
 */
export function toTitleCase(str: string): string {
  if (!str) return str
  
  return str
    .toLowerCase()
    .split(/[\s\-_]+/)
    .map((word, index) => {
      // Check if word is an acronym
      const upperWord = word.toUpperCase()
      if (ACRONYMS.includes(upperWord)) {
        return upperWord
      }
      
      // Check if word should be lowercase (but not at start)
      if (index > 0 && LOWERCASE_WORDS.includes(word.toLowerCase())) {
        return word.toLowerCase()
      }
      
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Clean and format category names
 */
export function formatCategory(category: string): string {
  if (!category) return category
  
  // Special cases for category formatting
  const specialCases: Record<string, string> = {
    'ai-tools': 'AI Tools',
    'ai_tools': 'AI Tools',
    'fintech': 'FinTech',
    'devtools': 'Dev Tools',
    'dev-tools': 'Dev Tools',
    'dev_tools': 'Dev Tools',
    'apis': 'APIs',
    'iot': 'IoT',
    'saas': 'SaaS',
    'paas': 'PaaS',
    'iaas': 'IaaS'
  }
  
  const normalized = category.toLowerCase().replace(/[\s\-_]+/g, '-')
  if (specialCases[normalized]) {
    return specialCases[normalized]
  }
  
  return toTitleCase(category)
}

/**
 * Clean and format auth method names
 */
export function formatAuthMethod(authMethod: string): string {
  if (!authMethod) return authMethod
  
  // Special cases for auth method formatting
  const specialCases: Record<string, string> = {
    'api_key': 'API Key',
    'api-key': 'API Key',
    'personal_access_token': 'Personal Access Token',
    'personal-access-token': 'Personal Access Token',
    'integration_token': 'Integration Token',
    'integration-token': 'Integration Token',
    'secret_key': 'Secret Key',
    'secret-key': 'Secret Key',
    'bearer_token': 'Bearer Token',
    'bearer-token': 'Bearer Token',
    'oauth': 'OAuth',
    'oauth2': 'OAuth 2.0',
    'jwt': 'JWT Token',
    'basic_auth': 'Basic Auth',
    'basic-auth': 'Basic Auth',
    'none': 'None Required',
    'no_auth': 'None Required',
    'no-auth': 'None Required'
  }
  
  const normalized = authMethod.toLowerCase().replace(/[\s\-_]+/g, '-')
  if (specialCases[normalized]) {
    return specialCases[normalized]
  }
  
  return toTitleCase(authMethod)
}

/**
 * Clean and format use case text
 */
export function formatUseCase(useCase: string): string {
  if (!useCase) return useCase
  
  // Clean the string and apply title case
  const cleaned = useCase.replace(/[-_]/g, ' ').trim()
  return toTitleCase(cleaned)
}

/**
 * Format connection type for display
 */
export function formatConnectionType(connectionType: string): string {
  if (!connectionType) return connectionType
  
  const specialCases: Record<string, string> = {
    'stdio': 'Standard I/O',
    'http': 'HTTP',
    'https': 'HTTPS',
    'tcp': 'TCP',
    'udp': 'UDP',
    'ws': 'WebSocket',
    'wss': 'WebSocket Secure'
  }
  
  const normalized = connectionType.toLowerCase()
  if (specialCases[normalized]) {
    return specialCases[normalized]
  }
  
  return toTitleCase(connectionType)
}

/**
 * Format health status for display
 */
export function formatHealthStatus(status: string): string {
  if (!status) return status
  
  const statusMap: Record<string, string> = {
    'healthy': 'Healthy',
    'degraded': 'Degraded',
    'down': 'Down',
    'unknown': 'Unknown',
    'requires_auth': 'Requires Auth',
    'requires-auth': 'Requires Auth'
  }
  
  return statusMap[status.toLowerCase()] || toTitleCase(status)
}

/**
 * Format pricing model for display
 */
export function formatPricingModel(pricingModel: string): string {
  if (!pricingModel) return pricingModel
  
  const pricingMap: Record<string, string> = {
    'free': 'Free',
    'freemium': 'Freemium',
    'paid': 'Paid',
    'subscription': 'Subscription',
    'one-time': 'One-time',
    'usage-based': 'Usage-based',
    'enterprise': 'Enterprise'
  }
  
  return pricingMap[pricingModel.toLowerCase()] || toTitleCase(pricingModel)
}