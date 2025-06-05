/**
 * Slug Generator - Consistent, predictable slug generation
 * 
 * Rules:
 * 1. Scoped packages: @org/package → org-package
 * 2. Special chars: replace with hyphens
 * 3. Multiple hyphens: collapse to single
 * 4. Case: always lowercase
 * 5. Uniqueness: append install_type if needed
 */

class SlugGenerator {
  /**
   * Generate a consistent slug from package name - ALWAYS SAME AS NAME
   * @param {string} packageName - Original package name
   * @param {string} installType - npm, pipx, cargo, go (ignored for consistency)
   * @returns {string} URL-safe slug that matches name
   */
  static generate(packageName, installType) {
    if (!packageName) return '';
    
    // CRITICAL: Keep slug same as name for consistency
    // Just clean the name to be URL-safe
    let slug = packageName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with -
      .replace(/-+/g, '-')          // Collapse multiple hyphens
      .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
    
    return slug;
  }
  
  /**
   * Generate slug with deduplication
   * @param {string} packageName 
   * @param {string} installType 
   * @param {Array} existingSlugs - Array of existing slugs to check against
   * @returns {string} Unique slug
   */
  static generateUnique(packageName, installType, existingSlugs = []) {
    let baseSlug = this.generate(packageName, installType);
    let slug = baseSlug;
    let counter = 1;
    
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }
  
  /**
   * Validate a slug
   * @param {string} slug 
   * @returns {boolean}
   */
  static isValid(slug) {
    return /^[a-z0-9-]+$/.test(slug) && 
           !slug.startsWith('-') && 
           !slug.endsWith('-') &&
           slug.length > 0 &&
           slug.length < 100;
  }
}

module.exports = { SlugGenerator };