# URL Structure Changes

## Overview

The URL structure for MCP detail pages has been updated to provide cleaner, more intuitive URLs.

## New URL Format

### Official MCPs
- **Format**: `/mcp/{clean-name}`
- **Example**: 
  - Old: `/mcp/github-official`
  - New: `/mcp/github`

### Community MCPs
- **Format**: `/mcp/{clean-name}-{author}`
- **Example**: 
  - Old: `/mcp/slack-community`
  - New: `/mcp/slack-slackuser`

## Implementation Details

### Slug Generation Logic

```typescript
function generateSlug(name: string, author?: string, verified?: boolean): string {
  // Clean the base name (remove "Official"/"Community" suffix)
  let cleanName = name
    .replace(/\s+(Official|Community)$/i, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  // For official MCPs, just return the clean name
  if (verified) {
    return cleanName
  }

  // For community MCPs, append author if available
  if (author) {
    const cleanAuthor = author
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')

    return `${cleanName}-${cleanAuthor}`
  }

  // Fallback to just the clean name
  return cleanName
}
```

### Author Detection

For new submissions, the author comes from the submission form. For existing MCPs:

1. Use the `author` field if available
2. Extract from GitHub URL if no author field exists
3. Fallback to just the clean name

## Migration

### Scripts Available

1. **Test slug generation**: `npm run test-slugs`
2. **Update existing slugs**: `npm run update-slugs`

### Migration Process

1. The `update-slugs` script will:
   - Fetch all existing MCPs
   - Generate new slugs using the updated logic
   - Show a preview of changes
   - Require confirmation before applying
   - Update the database with new slugs

## Examples

### Before and After

| Type | Name | Author | Old Slug | New Slug |
|------|------|--------|----------|----------|
| Official | GitHub Official | github | `github-official` | `github` |
| Official | Notion Official | notionhq | `notion-official` | `notion` |
| Community | Slack Community | slack-user | `slack-community` | `slack-slack-user` |
| Community | Custom Tool | john-doe | `custom-tool` | `custom-tool-john-doe` |

## Benefits

1. **Cleaner URLs**: Official MCPs have shorter, cleaner URLs
2. **Better Attribution**: Community MCPs clearly show the author
3. **Consistent Format**: Clear distinction between official and community
4. **SEO Friendly**: More descriptive and intuitive URLs
5. **Future Proof**: Supports proper attribution for community contributions