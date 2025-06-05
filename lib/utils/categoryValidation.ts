/**
 * Category validation utilities for E14Z MCP system
 * Ensures all MCPs use only hardcoded categories for data consistency
 */

export const HARDCODED_CATEGORIES = [
  'databases',
  'payments', 
  'ai-tools',
  'development-tools',
  'cloud-storage',
  'messaging',
  'content-creation',
  'monitoring',
  'project-management',
  'security',
  'automation',
  'social-media',
  'web-apis',
  'productivity',
  'infrastructure',
  'media-processing',
  'finance',
  'communication',
  'research',
  'iot'
] as const;

export type ValidCategory = typeof HARDCODED_CATEGORIES[number];

/**
 * Validate if a category is in the hardcoded list
 */
export function isValidCategory(category: string): category is ValidCategory {
  return HARDCODED_CATEGORIES.includes(category as ValidCategory);
}

/**
 * Get the fallback category for invalid inputs
 */
export function getFallbackCategory(): ValidCategory {
  return 'development-tools';
}

/**
 * Suggest the best matching category from freeform text
 */
export function suggestCategory(input: string): ValidCategory {
  const normalized = input.toLowerCase().trim();
  
  // Direct matches
  if (HARDCODED_CATEGORIES.includes(normalized as ValidCategory)) {
    return normalized as ValidCategory;
  }
  
  // Common mappings
  const mappings: Record<string, ValidCategory> = {
    'fintech': 'payments',
    'database': 'databases',
    'db': 'databases',
    'payment': 'payments',
    'stripe': 'payments',
    'paypal': 'payments',
    'bitcoin': 'payments',
    'crypto': 'payments',
    'ai': 'ai-tools',
    'llm': 'ai-tools',
    'ml': 'ai-tools',
    'machine learning': 'ai-tools',
    'artificial intelligence': 'ai-tools',
    'development': 'development-tools',
    'dev': 'development-tools',
    'coding': 'development-tools',
    'git': 'development-tools',
    'github': 'development-tools',
    'testing': 'development-tools',
    'ci/cd': 'development-tools',
    'storage': 'cloud-storage',
    'file': 'cloud-storage',
    'drive': 'cloud-storage',
    's3': 'cloud-storage',
    'slack': 'messaging',
    'discord': 'messaging',
    'email': 'messaging',
    'sms': 'messaging',
    'chat': 'messaging',
    'text': 'content-creation',
    'image': 'content-creation',
    'video': 'content-creation',
    'audio': 'media-processing',
    'music': 'media-processing',
    'analytics': 'monitoring',
    'logging': 'monitoring',
    'metrics': 'monitoring',
    'task': 'project-management',
    'project': 'project-management',
    'team': 'project-management',
    'crm': 'project-management',
    'auth': 'security',
    'oauth': 'security',
    'encryption': 'security',
    'workflow': 'automation',
    'trigger': 'automation',
    'twitter': 'social-media',
    'linkedin': 'social-media',
    'facebook': 'social-media',
    'api': 'web-apis',
    'rest': 'web-apis',
    'webhook': 'web-apis',
    'calendar': 'productivity',
    'note': 'productivity',
    'document': 'productivity',
    'server': 'infrastructure',
    'deploy': 'infrastructure',
    'docker': 'infrastructure',
    'aws': 'infrastructure',
    'cloud': 'infrastructure',
    'finance': 'finance',
    'accounting': 'finance',
    'invoice': 'finance',
    'call': 'communication',
    'meeting': 'communication',
    'video call': 'communication',
    'research': 'research',
    'academic': 'research',
    'data': 'research',
    'iot': 'iot',
    'smart home': 'iot',
    'device': 'iot'
  };
  
  // Check for keyword matches
  for (const [keyword, category] of Object.entries(mappings)) {
    if (normalized.includes(keyword)) {
      return category;
    }
  }
  
  // Fallback
  return getFallbackCategory();
}

/**
 * Validate and normalize a category input
 */
export function validateAndNormalizeCategory(input: string | null | undefined): ValidCategory {
  if (!input) return getFallbackCategory();
  
  const normalized = input.toLowerCase().trim();
  
  if (isValidCategory(normalized)) {
    return normalized;
  }
  
  return suggestCategory(input);
}

/**
 * Get the formatted display name for a category
 */
export function formatCategoryName(category: ValidCategory): string {
  const formatted = category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Handle special cases for proper capitalization
  return formatted
    .replace(/\bAi\b/g, 'AI')   // "Ai Tools" → "AI Tools"
    .replace(/\bIot\b/g, 'IoT') // "Iot" → "IoT"
    .replace(/\bApis\b/g, 'APIs') // "Web Apis" → "Web APIs"
    .replace(/\bApi\b/g, 'API'); // "Api" → "API"
}

/**
 * Get category display information
 */
export function getCategoryInfo(category: ValidCategory) {
  const descriptions: Record<ValidCategory, string> = {
    'databases': 'Database management and data storage systems',
    'payments': 'Payment processing and financial transactions',
    'ai-tools': 'AI models, LLMs, and machine learning services',
    'development-tools': 'Software development and coding tools',
    'cloud-storage': 'File storage and cloud storage services',
    'messaging': 'Communication and messaging platforms',
    'content-creation': 'Content generation and creative tools',
    'monitoring': 'System monitoring and analytics',
    'project-management': 'Task tracking and team collaboration',
    'security': 'Security, authentication, and access control',
    'automation': 'Workflow automation and triggers',
    'social-media': 'Social media platforms and integration',
    'web-apis': 'Web APIs, REST services, and integrations',
    'productivity': 'Productivity and office tools',
    'infrastructure': 'Infrastructure, deployment, and DevOps',
    'media-processing': 'Audio, video, and media manipulation',
    'finance': 'Financial services and accounting',
    'communication': 'Communication and collaboration tools',
    'research': 'Research tools and academic resources',
    'iot': 'IoT devices and smart home integration'
  };
  
  return {
    id: category,
    name: formatCategoryName(category),
    description: descriptions[category]
  };
}