/**
 * Code Plagiarism Detection Service
 * Specialized service for detecting plagiarism in code submissions
 */

import { PlagiarismMatch, DetectionMethod } from '../models/PlagiarismDetection';
import logger from '../utils/logger';

export interface CodeToken {
  type: string;
  value: string;
  position: number;
}

export interface CodeASTNode {
  type: string;
  name?: string;
  value?: string;
  children?: CodeASTNode[];
  position?: {
    start: number;
    end: number;
  };
}

export interface CodeStructure {
  functions: Array<{
    name: string;
    parameters: string[];
    lines: number;
    complexity: number;
  }>;
  classes: Array<{
    name: string;
    methods: string[];
    properties: string[];
    inheritance?: string[];
  }>;
  variables: Array<{
    name: string;
    type: string;
    scope: string;
  }>;
  imports: string[];
  controlFlow: Array<{
    type: string;
    condition: string;
    nesting: number;
  }>;
}

export class CodePlagiarismAnalyzer {
  private languageParsers: Map<string, CodeParser>;
  private similarityThresholds: Map<string, number>;

  constructor() {
    this.languageParsers = new Map();
    this.similarityThresholds = new Map();
    this.initializeParsers();
  }

  /**
   * Initialize language-specific parsers
   */
  private initializeParsers(): void {
    this.languageParsers.set('javascript', new JavaScriptParser());
    this.languageParsers.set('python', new PythonParser());
    this.languageParsers.set('java', new JavaParser());
    this.languageParsers.set('cpp', new CppParser());
    this.languageParsers.set('csharp', new CSharpParser());
    this.languageParsers.set('php', new PHPParser());
    this.languageParsers.set('typescript', new TypeScriptParser());

    // Set similarity thresholds for each language
    this.similarityThresholds.set('javascript', 0.7);
    this.similarityThresholds.set('python', 0.75);
    this.similarityThresholds.set('java', 0.8);
    this.similarityThresholds.set('cpp', 0.75);
    this.similarityThresholds.set('csharp', 0.8);
    this.similarityThresholds.set('php', 0.7);
    this.similarityThresholds.set('typescript', 0.7);
  }

  /**
   * AST-based similarity analysis
   */
  async astSimilarity(code: string, language: string, sensitivity: string): Promise<PlagiarismMatch[]> {
    const matches: PlagiarismMatch[] = [];

    try {
      const parser = this.languageParsers.get(language);
      if (!parser) {
        logger.warn(`No parser available for language: ${language}`);
        return matches;
      }

      const ast1 = parser.parseAST(code);
      
      // Compare with known code samples (in real implementation, this would query a database)
      const knownSamples = await this.getKnownCodeSamples(language);
      
      for (const sample of knownSamples) {
        const ast2 = parser.parseAST(sample.code);
        const similarity = this.compareASTs(ast1, ast2);
        
        if (similarity >= this.getThreshold(sensitivity)) {
          matches.push(this.createCodeMatch(sample, similarity, DetectionMethod.CODE_SIMILARITY));
        }
      }

    } catch (error) {
      logger.error('Error in AST similarity analysis:', error);
    }

    return matches;
  }

  /**
   * Token-based similarity analysis
   */
  async tokenSimilarity(code: string, language: string, sensitivity: string): Promise<PlagiarismMatch[]> {
    const matches: PlagiarismMatch[] = [];

    try {
      const parser = this.languageParsers.get(language);
      if (!parser) {
        return matches;
      }

      const tokens1 = parser.tokenize(code);
      const knownSamples = await this.getKnownCodeSamples(language);
      
      for (const sample of knownSamples) {
        const tokens2 = parser.tokenize(sample.code);
        const similarity = this.compareTokenSequences(tokens1, tokens2);
        
        if (similarity >= this.getThreshold(sensitivity)) {
          matches.push(this.createCodeMatch(sample, similarity, DetectionMethod.CODE_SIMILARITY));
        }
      }

    } catch (error) {
      logger.error('Error in token similarity analysis:', error);
    }

    return matches;
  }

  /**
   * Structural similarity analysis
   */
  async structuralSimilarity(code: string, language: string, sensitivity: string): Promise<PlagiarismMatch[]> {
    const matches: PlagiarismMatch[] = [];

    try {
      const parser = this.languageParsers.get(language);
      if (!parser) {
        return matches;
      }

      const structure1 = parser.analyzeStructure(code);
      const knownSamples = await this.getKnownCodeSamples(language);
      
      for (const sample of knownSamples) {
        const structure2 = parser.analyzeStructure(sample.code);
        const similarity = this.compareStructures(structure1, structure2);
        
        if (similarity >= this.getThreshold(sensitivity)) {
          matches.push(this.createCodeMatch(sample, similarity, DetectionMethod.CODE_SIMILARITY));
        }
      }

    } catch (error) {
      logger.error('Error in structural similarity analysis:', error);
    }

    return matches;
  }

  /**
   * Compare two ASTs for similarity
   */
  private compareASTs(ast1: CodeASTNode, ast2: CodeASTNode): number {
    if (!ast1 || !ast2) return 0;

    const similarities: number[] = [];
    
    // Compare node types
    if (ast1.type === ast2.type) {
      similarities.push(1.0);
    }

    // Compare node names/values
    if (ast1.name && ast2.name && ast1.name === ast2.name) {
      similarities.push(1.0);
    } else if (ast1.value && ast2.value && ast1.value === ast2.value) {
      similarities.push(1.0);
    }

    // Compare children recursively
    if (ast1.children && ast2.children) {
      const childSimilarity = this.compareASTLists(ast1.children, ast2.children);
      similarities.push(childSimilarity);
    }

    // Return weighted average
    return similarities.length > 0 ? similarities.reduce((a, b) => a + b) / similarities.length : 0;
  }

  /**
   * Compare lists of AST nodes
   */
  private compareASTLists(nodes1: CodeASTNode[], nodes2: CodeASTNode[]): number {
    if (nodes1.length === 0 && nodes2.length === 0) return 1.0;
    if (nodes1.length === 0 || nodes2.length === 0) return 0.0;

    const maxSimilarity = Math.max(nodes1.length, nodes2.length);
    let totalSimilarity = 0;

    for (let i = 0; i < Math.min(nodes1.length, nodes2.length); i++) {
      totalSimilarity += this.compareASTs(nodes1[i], nodes2[i]);
    }

    return totalSimilarity / maxSimilarity;
  }

  /**
   * Compare token sequences
   */
  private compareTokenSequences(tokens1: CodeToken[], tokens2: CodeToken[]): number {
    if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
    if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

    // Filter out identifiers and literals for more meaningful comparison
    const filtered1 = tokens1.filter(t => !['identifier', 'literal', 'comment'].includes(t.type));
    const filtered2 = tokens2.filter(t => !['identifier', 'literal', 'comment'].includes(t.type));

    if (filtered1.length === 0 && filtered2.length === 0) return 1.0;
    if (filtered1.length === 0 || filtered2.length === 0) return 0.0;

    // Calculate Jaccard similarity
    const set1 = new Set(filtered1.map(t => t.type + ':' + t.value));
    const set2 = new Set(filtered2.map(t => t.type + ':' + t.value));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Compare code structures
   */
  private compareStructures(struct1: CodeStructure, struct2: CodeStructure): number {
    const similarities: number[] = [];

    // Compare functions
    const funcSimilarity = this.compareFunctionLists(struct1.functions, struct2.functions);
    similarities.push(funcSimilarity);

    // Compare classes
    const classSimilarity = this.compareClassLists(struct1.classes, struct2.classes);
    similarities.push(classSimilarity);

    // Compare control flow
    const flowSimilarity = this.compareControlFlow(struct1.controlFlow, struct2.controlFlow);
    similarities.push(flowSimilarity);

    // Compare imports
    const importSimilarity = this.compareImportLists(struct1.imports, struct2.imports);
    similarities.push(importSimilarity);

    return similarities.reduce((a, b) => a + b) / similarities.length;
  }

  /**
   * Compare function lists
   */
  private compareFunctionList(funcs1: any[], funcs2: any[]): number {
    if (funcs1.length === 0 && funcs2.length === 0) return 1.0;
    if (funcs1.length === 0 || funcs2.length === 0) return 0.0;

    let similarities = 0;
    const maxCount = Math.max(funcs1.length, funcs2.length);

    for (const f1 of funcs1) {
      for (const f2 of funcs2) {
        if (f1.name === f2.name) {
          similarities += this.calculateFunctionSimilarity(f1, f2);
          break;
        }
      }
    }

    return similarities / maxCount;
  }

  /**
   * Calculate similarity between two functions
   */
  private calculateFunctionSimilarity(func1: any, func2: any): number {
    let similarity = 0;
    let factors = 0;

    // Parameter count similarity
    if (func1.parameters.length === func2.parameters.length) {
      similarity += 1;
    }
    factors++;

    // Line count similarity
    const lineDiff = Math.abs(func1.lines - func2.lines);
    const maxLines = Math.max(func1.lines, func2.lines);
    if (maxLines > 0) {
      similarity += 1 - (lineDiff / maxLines);
    }
    factors++;

    // Complexity similarity
    const complexDiff = Math.abs(func1.complexity - func2.complexity);
    const maxComplexity = Math.max(func1.complexity, func2.complexity);
    if (maxComplexity > 0) {
      similarity += 1 - (complexDiff / maxComplexity);
    }
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Compare class lists
   */
  private compareClassLists(classes1: any[], classes2: any[]): number {
    if (classes1.length === 0 && classes2.length === 0) return 1.0;
    if (classes1.length === 0 || classes2.length === 0) return 0.0;

    let similarities = 0;
    const maxCount = Math.max(classes1.length, classes2.length);

    for (const c1 of classes1) {
      for (const c2 of classes2) {
        if (c1.name === c2.name) {
          similarities += this.calculateClassSimilarity(c1, c2);
          break;
        }
      }
    }

    return similarities / maxCount;
  }

  /**
   * Calculate similarity between two classes
   */
  private calculateClassSimilarity(class1: any, class2: any): number {
    let similarity = 0;
    let factors = 0;

    // Method count similarity
    const methodDiff = Math.abs(class1.methods.length - class2.methods.length);
    const maxMethods = Math.max(class1.methods.length, class2.methods.length);
    if (maxMethods > 0) {
      similarity += 1 - (methodDiff / maxMethods);
    }
    factors++;

    // Property count similarity
    const propDiff = Math.abs(class1.properties.length - class2.properties.length);
    const maxProps = Math.max(class1.properties.length, class2.properties.length);
    if (maxProps > 0) {
      similarity += 1 - (propDiff / maxProps);
    }
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Compare control flow structures
   */
  private compareControlFlow(flow1: any[], flow2: any[]): number {
    if (flow1.length === 0 && flow2.length === 0) return 1.0;
    if (flow1.length === 0 || flow2.length === 0) return 0.0;

    const types1 = flow1.map(f => f.type);
    const types2 = flow2.map(f => f.type);

    const set1 = new Set(types1);
    const set2 = new Set(types2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Compare import lists
   */
  private compareImportLists(imports1: string[], imports2: string[]): number {
    if (imports1.length === 0 && imports2.length === 0) return 1.0;
    if (imports1.length === 0 || imports2.length === 0) return 0.0;

    const set1 = new Set(imports1);
    const set2 = new Set(imports2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Get similarity threshold based on sensitivity
   */
  private getThreshold(sensitivity: string): number {
    switch (sensitivity) {
      case 'low': return 0.8;
      case 'medium': return 0.6;
      case 'high': return 0.4;
      default: return 0.6;
    }
  }

  /**
   * Create plagiarism match for code
   */
  private createCodeMatch(sample: any, similarity: number, method: DetectionMethod): PlagiarismMatch {
    return {
      id: this.generateUUID(),
      source: {
        id: sample.id,
        type: 'code_repository',
        title: sample.title,
        url: sample.url,
        author: sample.author,
        confidence: 0.8,
        matchedContent: sample.code,
        similarityScore: similarity
      },
      detectionMethod: method,
      similarityPercentage: similarity * 100,
      matchedWords: Math.floor(similarity * sample.code.split(/\s+/).length),
      totalWords: sample.code.split(/\s+/).length,
      startPosition: 0,
      endPosition: sample.code.length,
      originalText: sample.code,
      matchedText: sample.code,
      isParaphrased: false,
      isTranslated: false
    };
  }

  /**
   * Generate UUID
   */
  private generateUUID(): string {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }

  /**
   * Get known code samples (mock implementation)
   */
  private async getKnownCodeSamples(language: string): Promise<any[]> {
    // In real implementation, this would query a database of known code samples
    return [
      {
        id: 'sample1',
        title: 'Sample function',
        code: 'function example() { console.log("Hello World"); }',
        url: 'https://example.com/code1',
        author: 'John Doe'
      }
    ];
  }
}

// Base interface for language parsers
interface CodeParser {
  parseAST(code: string): CodeASTNode;
  tokenize(code: string): CodeToken[];
  analyzeStructure(code: string): CodeStructure;
}

// Mock implementations for different languages (would be replaced with actual parsers)
class JavaScriptParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    // Mock AST parsing - would use actual parser like acorn or babel
    return {
      type: 'Program',
      children: []
    };
  }

  tokenize(code: string): CodeToken[] {
    // Mock tokenization
    const tokens: CodeToken[] = [];
    const words = code.split(/\s+/);
    words.forEach((word, index) => {
      tokens.push({
        type: 'identifier',
        value: word,
        position: index
      });
    });
    return tokens;
  }

  analyzeStructure(code: string): CodeStructure {
    // Mock structure analysis
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}

class PythonParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    return { type: 'Module', children: [] };
  }

  tokenize(code: string): CodeToken[] {
    return [];
  }

  analyzeStructure(code: string): CodeStructure {
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}

class JavaParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    return { type: 'CompilationUnit', children: [] };
  }

  tokenize(code: string): CodeToken[] {
    return [];
  }

  analyzeStructure(code: string): CodeStructure {
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}

class CppParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    return { type: 'TranslationUnit', children: [] };
  }

  tokenize(code: string): CodeToken[] {
    return [];
  }

  analyzeStructure(code: string): CodeStructure {
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}

class CSharpParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    return { type: 'CompilationUnit', children: [] };
  }

  tokenize(code: string): CodeToken[] {
    return [];
  }

  analyzeStructure(code: string): CodeStructure {
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}

class PHPParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    return { type: 'Script', children: [] };
  }

  tokenize(code: string): CodeToken[] {
    return [];
  }

  analyzeStructure(code: string): CodeStructure {
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}

class TypeScriptParser implements CodeParser {
  parseAST(code: string): CodeASTNode {
    return { type: 'SourceFile', children: [] };
  }

  tokenize(code: string): CodeToken[] {
    return [];
  }

  analyzeStructure(code: string): CodeStructure {
    return {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      controlFlow: []
    };
  }
}
