// NOTE: This module intentionally only imports *type* and *runtime* APIs that
// are safe in both server and client bundles. Avoid importing heavy modules
// (three, recharts, d3, wagmi, etc.) at the top level — they would otherwise
// be hoisted into every page that touches this file.
import { performanceReporting, BundleAnalysis } from './performance-reporting';

export interface OptimizationSuggestion {
  category: 'images' | 'javascript' | 'css' | 'network' | 'server' | 'caching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
  resources?: string[];
}

export interface PerformanceAuditResult {
  score: number;
  suggestions: OptimizationSuggestion[];
  bundleAnalysis?: BundleAnalysis;
  metrics: {
    totalSize: number;
    requestCount: number;
    loadTime: number;
    renderTime: number;
  };
}

class PerformanceOptimizationService {
  async runFullAudit(): Promise<PerformanceAuditResult> {
    const suggestions = await this.generateOptimizationSuggestions();
    const bundleAnalysis = await this.analyzeBundle();
    const metrics = await this.collectPerformanceMetrics();
    const score = this.calculateOptimizationScore(suggestions, metrics);

    return {
      score,
      suggestions,
      bundleAnalysis,
      metrics,
    };
  }

  private async generateOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Image optimization suggestions
    suggestions.push(...await this.analyzeImages());
    
    // JavaScript optimization suggestions
    suggestions.push(...await this.analyzeJavaScript());
    
    // CSS optimization suggestions
    suggestions.push(...await this.analyzeCSS());
    
    // Network optimization suggestions
    suggestions.push(...await this.analyzeNetwork());
    
    // Server optimization suggestions
    suggestions.push(...await this.analyzeServer());
    
    // Caching suggestions
    suggestions.push(...await this.analyzeCaching());

    return suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async analyzeImages(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const images = document.querySelectorAll('img');

    if (images.length === 0) return suggestions;

    // Check for missing alt attributes
    const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
    if (imagesWithoutAlt.length > 0) {
      suggestions.push({
        category: 'images',
        priority: 'medium',
        title: 'Add alt attributes to images',
        description: `${imagesWithoutAlt.length} images are missing alt attributes, which affects accessibility and SEO.`,
        impact: 'Improves accessibility and SEO',
        effort: 'low',
        implementation: 'Add descriptive alt attributes to all images',
      });
    }

    // Check for large images
    const largeImages = Array.from(images).filter(img => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      return naturalWidth > 2000 || naturalHeight > 2000;
    });

    if (largeImages.length > 0) {
      suggestions.push({
        category: 'images',
        priority: 'high',
        title: 'Optimize large images',
        description: `${largeImages.length} images are larger than 2000px in at least one dimension.`,
        impact: 'Reduces page load size and improves load times',
        effort: 'medium',
        implementation: 'Resize images to appropriate dimensions and use responsive images with srcset',
        resources: ['https://web.dev/responsive-images/'],
      });
    }

    // Check for modern image formats
    const hasModernFormats = Array.from(images).some(img => 
      img.src.includes('.webp') || img.src.includes('.avif')
    );

    if (!hasModernFormats) {
      suggestions.push({
        category: 'images',
        priority: 'medium',
        title: 'Use modern image formats',
        description: 'Consider using WebP or AVIF formats for better compression.',
        impact: 'Reduces image file sizes by 25-35%',
        effort: 'medium',
        implementation: 'Convert images to WebP/AVIF and use <picture> element with fallbacks',
        resources: ['https://web.dev/serve-images-webp/'],
      });
    }

    return suggestions;
  }

  private async analyzeJavaScript(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for unused JavaScript
    const scripts = document.querySelectorAll('script[src]');
    if (scripts.length > 5) {
      suggestions.push({
        category: 'javascript',
        priority: 'medium',
        title: 'Reduce JavaScript bundle size',
        description: `Page loads ${scripts.length} JavaScript files. Consider code splitting.`,
        impact: 'Reduces initial load time and JavaScript execution time',
        effort: 'high',
        implementation: 'Implement dynamic imports and code splitting for unused features',
        resources: ['https://web.dev/code-splitting-suspense/'],
      });
    }

    // Check for render-blocking scripts
    const blockingScripts = Array.from(scripts).filter(script => 
      !script.async && !script.defer && script.hasAttribute('src')
    );

    if (blockingScripts.length > 0) {
      suggestions.push({
        category: 'javascript',
        priority: 'high',
        title: 'Eliminate render-blocking JavaScript',
        description: `${blockingScripts.length} scripts are blocking page rendering.`,
        impact: 'Improves First Contentful Paint and page interactivity',
        effort: 'low',
        implementation: 'Add async or defer attributes to non-critical scripts',
      });
    }

    return suggestions;
  }

  private async analyzeCSS(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for unused CSS
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    if (stylesheets.length > 3) {
      suggestions.push({
        category: 'css',
        priority: 'medium',
        title: 'Optimize CSS delivery',
        description: `Page loads ${stylesheets.length} stylesheets. Consider critical CSS.`,
        impact: 'Reduces render-blocking resources and improves load times',
        effort: 'medium',
        implementation: 'Extract critical CSS and load non-critical CSS asynchronously',
        resources: ['https://web.dev/extract-critical-css/'],
      });
    }

    return suggestions;
  }

  private async analyzeNetwork(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for HTTP/2
    if (location.protocol === 'https:') {
      suggestions.push({
        category: 'network',
        priority: 'low',
        title: 'Enable HTTP/2 or HTTP/3',
        description: 'Ensure your server supports HTTP/2 or HTTP/3 for better multiplexing.',
        impact: 'Improves resource loading parallelism',
        effort: 'low',
        implementation: 'Configure server to use HTTP/2 or HTTP/3',
      });
    }

    // Check for resource hints
    const hasPreconnect = document.querySelector('link[rel="preconnect"]');
    const hasDnsPrefetch = document.querySelector('link[rel="dns-prefetch"]');
    
    if (!hasPreconnect && !hasDnsPrefetch) {
      suggestions.push({
        category: 'network',
        priority: 'low',
        title: 'Add resource hints',
        description: 'Add preconnect and dns-prefetch for external resources.',
        impact: 'Reduces DNS lookup and connection time',
        effort: 'low',
        implementation: 'Add <link rel="preconnect"> and <link rel="dns-prefetch"> tags',
      });
    }

    return suggestions;
  }

  private async analyzeServer(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for compression
    const hasCompression = await this.checkCompression();
    if (!hasCompression) {
      suggestions.push({
        category: 'server',
        priority: 'high',
        title: 'Enable compression',
        description: 'Enable Gzip or Brotli compression on your server.',
        impact: 'Reduces response sizes by 60-80%',
        effort: 'low',
        implementation: 'Configure server to use compression middleware',
      });
    }

    return suggestions;
  }

  private async analyzeCaching(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for cache headers (this is a simplified check)
    suggestions.push({
      category: 'caching',
      priority: 'medium',
      title: 'Implement browser caching',
      description: 'Set appropriate cache headers for static assets.',
      impact: 'Reduces repeat visit load times',
      effort: 'low',
      implementation: 'Configure Cache-Control and ETag headers',
    });

    return suggestions;
  }

  private async analyzeBundle(): Promise<BundleAnalysis | undefined> {
    try {
      return await performanceReporting.analyzeBundle();
    } catch (error) {
      console.warn('Bundle analysis failed:', error);
      return undefined;
    }
  }

  private async collectPerformanceMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource');

    return {
      totalSize: this.estimateTotalSize(resources),
      requestCount: resources.length,
      loadTime: navigation?.loadEventEnd - navigation?.navigationStart || 0,
      renderTime: navigation?.domContentLoadedEventEnd - navigation?.navigationStart || 0,
    };
  }

  private estimateTotalSize(resources: PerformanceResourceTiming[]): number {
    // This is a rough estimate - actual size would need server-side reporting
    return resources.reduce((total, resource) => {
      return total + (resource.transferSize || 0);
    }, 0);
  }

  private async checkCompression(): Promise<boolean> {
    try {
      const response = await fetch(window.location.href, { method: 'HEAD' });
      const encoding = response.headers.get('content-encoding');
      return encoding === 'gzip' || encoding === 'br';
    } catch {
      return false;
    }
  }

  private calculateOptimizationScore(
    suggestions: OptimizationSuggestion[],
    metrics: any
  ): number {
    let score = 100;

    // Deduct points based on suggestions
    suggestions.forEach(suggestion => {
      const deduction = {
        critical: 20,
        high: 15,
        medium: 10,
        low: 5,
      };
      score -= deduction[suggestion.priority];
    });

    // Deduct points based on metrics
    if (metrics.loadTime > 3000) score -= 10;
    if (metrics.requestCount > 50) score -= 10;
    if (metrics.totalSize > 1024 * 1024) score -= 10; // 1MB

    return Math.max(0, Math.min(100, score));
  }

  async implementOptimizations(suggestions: OptimizationSuggestion[]): Promise<void> {
    // This would integrate with build tools or CI/CD to automatically implement suggestions
    console.log('Implementing optimizations:', suggestions);
    
    // For now, just log what would be implemented
    suggestions.forEach(suggestion => {
      console.log(`[${suggestion.priority.toUpperCase()}] ${suggestion.title}: ${suggestion.implementation}`);
    });
  }
}

export const performanceOptimization = new PerformanceOptimizationService();

/* -------------------------------------------------------------------------- */
/*  Lazy-loading pattern (issue #141)                                         */
/* -------------------------------------------------------------------------- */

/**
 * This module is the *runtime* performance-audit service; helpers that
 * touch JSX live in `frontend/src/lib/lazy.tsx` (a `.tsx` module) so that
 * `performance-optimization.ts` remains a plain `.ts` and can be safely
 * imported from node-side tooling (e.g. `performance-reporting.ts`).
 *
 * The convention used by the routes that ship heaviest bundles is:
 *
 *   1. The App Router page is a **server component** so `metadata` works.
 *      It only renders a tiny `*Client.tsx` wrapper.
 *   2. The wrapper is `'use client'` and uses `next/dynamic` with
 *      `ssr: false` + a `<LoadingFallback message=...>` placeholder.
 *   3. The wrapper's children may continue to use `next/dynamic`
 *      internally so the 3D / physics dependencies inside
 *      `VirtualScienceLab` (LabScene3D, LabReactionSim) and
 *      `MetaverseCampus` (CampusScene) land in *additional* chunks.
 *
 * Existing examples:
 *   - `frontend/src/app/lab/LabClient.tsx` + `VirtualScienceLabSkeleton.tsx`
 *   - `frontend/src/app/campus/CampusClient.tsx`
 *
 * Pages-router pages (`src/pages/*`) don't need the wrapper because the
 * whole module is already client-rendered; they call `next/dynamic`
 * directly inline (see `pages/demo-features.tsx`, `pages/bci-dashboard.tsx`,
 * `pages/ConsciousnessPage.tsx`).
 */
