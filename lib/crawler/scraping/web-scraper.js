/**
 * Advanced Web Scraper Module
 * Uses Playwright + Cheerio + Turndown for rich content extraction
 * No external services required - runs directly in Node.js
 */

const { chromium } = require('playwright');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

class WebScraper {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    this.browser = null;
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });
    
    this.setupTurndown();
  }

  setupTurndown() {
    // Configure Turndown for better markdown conversion
    this.turndown.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: content => `~~${content}~~`
    });
    
    this.turndown.addRule('highlight', {
      filter: ['mark'],
      replacement: content => `==${content}==`
    });
    
    // Remove script and style tags completely
    this.turndown.remove(['script', 'style', 'meta', 'link']);
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({ 
        headless: this.headless,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a URL and extract rich content
   */
  async scrapeUrl(url, options = {}) {
    await this.initialize();
    
    const page = await this.browser.newPage();
    
    try {
      // Set user agent and viewport
      await page.setExtraHTTPHeaders({
        'User-Agent': this.userAgent
      });
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      console.log(`   🌐 Scraping: ${url}`);
      
      // Navigate to page
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.timeout 
      });
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }
      
      // Wait for dynamic content if specified
      if (options.waitFor) {
        await page.waitForTimeout(options.waitFor);
      }
      
      // Extract page content
      const content = await this.extractContent(page, options);
      
      return {
        url,
        success: true,
        statusCode: response.status(),
        ...content
      };
      
    } catch (error) {
      console.warn(`   ⚠️ Failed to scrape ${url}: ${error.message}`);
      return {
        url,
        success: false,
        error: error.message
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Extract comprehensive content from a page
   */
  async extractContent(page, options = {}) {
    // Get raw HTML
    const html = await page.content();
    
    // Parse with Cheerio for fast DOM manipulation
    const $ = cheerio.load(html);
    
    // Extract metadata
    const metadata = this.extractMetadata($);
    
    // Extract main content
    const mainContent = this.extractMainContent($);
    
    // Convert to markdown
    const markdown = this.turndown.turndown(mainContent.html);
    
    // Extract links
    const links = this.extractLinks($, page.url());
    
    // Extract structured data
    const structuredData = this.extractStructuredData($);
    
    return {
      title: metadata.title,
      description: metadata.description,
      keywords: metadata.keywords,
      author: metadata.author,
      publishDate: metadata.publishDate,
      
      content: {
        markdown: markdown.trim(),
        text: mainContent.text.trim(),
        html: mainContent.html
      },
      
      links: links,
      images: this.extractImages($, page.url()),
      structuredData: structuredData,
      
      stats: {
        wordCount: mainContent.text.split(/\s+/).length,
        readingTime: Math.ceil(mainContent.text.split(/\s+/).length / 200), // avg 200 wpm
        contentLength: mainContent.text.length
      }
    };
  }

  /**
   * Extract page metadata
   */
  extractMetadata($) {
    const title = $('title').text() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text() || '';

    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') || '';

    const keywords = $('meta[name="keywords"]').attr('content') || '';
    
    const author = $('meta[name="author"]').attr('content') || 
                   $('meta[property="article:author"]').attr('content') || 
                   $('.author').first().text() || '';

    const publishDate = $('meta[property="article:published_time"]').attr('content') || 
                       $('meta[name="publication_date"]').attr('content') || 
                       $('time[datetime]').attr('datetime') || '';

    return {
      title: title.trim(),
      description: description.trim(),
      keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
      author: author.trim(),
      publishDate: publishDate.trim()
    };
  }

  /**
   * Extract main content using content heuristics
   */
  extractMainContent($) {
    // Try common content containers including GitHub-specific selectors
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.readme',
      '#readme',
      '.markdown-body',
      '.documentation',
      // GitHub-specific selectors for repository pages
      '[data-target="readme-toc.content"]',
      '.Box-body.markdown-body',
      '.repository-content',
      '.file-navigation + .Box .markdown-body',
      '.js-code-nav-container'
    ];

    let mainContent = null;
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 100) {
        mainContent = element;
        console.log(`   📋 Content found with selector: ${selector} (${element.text().trim().length} chars)`);
        break;
      }
    }
    
    // Fallback: use body but remove common noise
    if (!mainContent) {
      console.log(`   📋 No content selectors matched, using body fallback`);
      mainContent = $('body').clone();
      
      // Remove common noise elements for GitHub and general sites
      mainContent.find('nav, header, footer, .sidebar, .navigation, .menu, .ads, .advertisement, script, style, .social-share, .AppHeader, .js-header-wrapper, .Header, .BorderGrid-cell--secondary').remove();
      
      console.log(`   📋 Body content after cleanup: ${mainContent.text().trim().length} chars`);
    }

    // Clean up content
    this.cleanContent(mainContent);

    return {
      html: mainContent.html() || '',
      text: mainContent.text() || ''
    };
  }

  /**
   * Clean content by removing noise and empty elements
   */
  cleanContent($element) {
    console.log(`   🧹 Cleaning content: ${$element.text().trim().length} chars before cleanup`);
    
    // Remove only truly empty paragraphs and divs (but preserve those with meaningful content)
    $element.find('p, div').each((i, el) => {
      const $el = $element.find(el);
      const text = $el.text().trim();
      const hasMediaOrLinks = $el.find('img, video, iframe, a[href]').length > 0;
      
      // Only remove if completely empty AND no media/links
      if (text.length === 0 && !hasMediaOrLinks) {
        $el.remove();
      }
    });

    // Remove script/style elements specifically
    $element.find('script, style, noscript').remove();
    
    console.log(`   🧹 Content after cleanup: ${$element.text().trim().length} chars`);
  }

  /**
   * Extract all links with context
   */
  extractLinks($, baseUrl) {
    const links = [];
    
    $('a[href]').each((i, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const text = $link.text().trim();
      
      if (href && text) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          links.push({
            url: absoluteUrl,
            text: text,
            internal: absoluteUrl.includes(new URL(baseUrl).hostname)
          });
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });
    
    return links.slice(0, 50); // Limit to 50 links
  }

  /**
   * Extract images with metadata
   */
  extractImages($, baseUrl) {
    const images = [];
    
    $('img[src]').each((i, el) => {
      const $img = $(el);
      const src = $img.attr('src');
      const alt = $img.attr('alt') || '';
      const title = $img.attr('title') || '';
      
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          images.push({
            url: absoluteUrl,
            alt: alt.trim(),
            title: title.trim()
          });
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });
    
    return images.slice(0, 20); // Limit to 20 images
  }

  /**
   * Extract structured data (JSON-LD, microdata, etc.)
   */
  extractStructuredData($) {
    const structuredData = [];
    
    // Extract JSON-LD
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        structuredData.push({
          type: 'json-ld',
          data: data
        });
      } catch (error) {
        // Invalid JSON, skip
      }
    });
    
    // Extract OpenGraph data
    const ogData = {};
    $('meta[property^="og:"]').each((i, el) => {
      const property = $(el).attr('property').replace('og:', '');
      const content = $(el).attr('content');
      if (property && content) {
        ogData[property] = content;
      }
    });
    
    if (Object.keys(ogData).length > 0) {
      structuredData.push({
        type: 'opengraph',
        data: ogData
      });
    }
    
    return structuredData;
  }

  /**
   * Scrape package documentation with intelligent content extraction
   */
  async scrapePackageDocumentation(urls, options = {}) {
    const results = [];
    
    for (const url of urls.slice(0, 3)) { // Limit to 3 URLs to avoid being blocked
      const result = await this.scrapeUrl(url, {
        waitFor: 2000, // Wait for dynamic content
        ...options
      });
      
      if (result.success) {
        results.push(result);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.consolidateDocumentation(results);
  }

  /**
   * Consolidate multiple documentation sources
   */
  consolidateDocumentation(results) {
    if (results.length === 0) return null;
    
    // Combine all content
    const combinedMarkdown = results
      .map(r => r.content.markdown)
      .join('\n\n---\n\n');
    
    const combinedText = results
      .map(r => r.content.text)
      .join(' ');
    
    // Extract all links
    const allLinks = results
      .flatMap(r => r.links)
      .filter((link, index, array) => 
        array.findIndex(l => l.url === link.url) === index
      );
    
    // Get best metadata (prefer first result)
    const bestResult = results[0];
    
    return {
      title: bestResult.title,
      description: bestResult.description,
      content: {
        markdown: combinedMarkdown,
        text: combinedText,
        wordCount: combinedText.split(/\s+/).length
      },
      links: allLinks,
      sources: results.map(r => ({ url: r.url, title: r.title }))
    };
  }
}

module.exports = { WebScraper };