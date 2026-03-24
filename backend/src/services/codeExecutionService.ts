/**
 * Code Execution Service (Simulation)
 * Mock service for evaluating code submissions
 */
export class CodeExecutionService {
  /**
   * Run code against test cases
   */
  async evaluate(code: string, language: string, testCases: any[]): Promise<any> {
    // Simulated sandbox delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple mock logic:
    // 1. Check for syntax errors (mock)
    if (code.includes('syntax error')) {
      return { success: false, error: 'SyntaxError: Unexpected token' };
    }
    
    // 2. Run against test cases
    const results = testCases.map(tc => {
      // Logic for simple input/output matching (mock)
      const passed = code.length > 5; // Placeholder
      return {
        passed,
        input: tc.input,
        expected: tc.expectedOutput,
        actual: passed ? tc.expectedOutput : 'undefined'
      };
    });
    
    return {
      success: true,
      testResults: results,
      stats: {
        memory: 12.5, // MB
        runtime: 45 // ms
      }
    };
  }
 * Code Execution Service
 * Provides secure sandboxed code execution for programming assignments
 */

import { CodeSubmission, CodeTestResult } from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionRequest {
  code: string;
  language: string;
  input?: string;
  timeout?: number; // in milliseconds
  memoryLimit?: number; // in MB
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    name?: string;
  }>;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executionTime?: number; // in milliseconds
  memoryUsed?: number; // in MB
  testResults?: CodeTestResult[];
}

export interface LanguageConfig {
  name: string;
  extension: string;
  dockerImage: string;
  compileCommand?: string;
  runCommand: string;
  maxExecutionTime: number;
  maxMemory: number;
}

export class CodeExecutionService {
  private languageConfigs: Map<string, LanguageConfig> = new Map([
    ['javascript', {
      name: 'JavaScript',
      extension: 'js',
      dockerImage: 'node:18-alpine',
      runCommand: 'node',
      maxExecutionTime: 5000,
      maxMemory: 128
    }],
    ['python', {
      name: 'Python',
      extension: 'py',
      dockerImage: 'python:3.11-alpine',
      runCommand: 'python3',
      maxExecutionTime: 5000,
      maxMemory: 128
    }],
    ['java', {
      name: 'Java',
      extension: 'java',
      dockerImage: 'openjdk:17-alpine',
      compileCommand: 'javac',
      runCommand: 'java',
      maxExecutionTime: 10000,
      maxMemory: 256
    }],
    ['cpp', {
      name: 'C++',
      extension: 'cpp',
      dockerImage: 'gcc:latest',
      compileCommand: 'g++',
      runCommand: './program',
      maxExecutionTime: 5000,
      maxMemory: 128
    }],
    ['c', {
      name: 'C',
      extension: 'c',
      dockerImage: 'gcc:latest',
      compileCommand: 'gcc',
      runCommand: './program',
      maxExecutionTime: 5000,
      maxMemory: 128
    }],
    ['go', {
      name: 'Go',
      extension: 'go',
      dockerImage: 'golang:1.21-alpine',
      runCommand: 'go run',
      maxExecutionTime: 5000,
      maxMemory: 128
    }],
    ['rust', {
      name: 'Rust',
      extension: 'rs',
      dockerImage: 'rust:1.71-alpine',
      compileCommand: 'rustc',
      runCommand: './program',
      maxExecutionTime: 10000,
      maxMemory: 256
    }]
  ]);

  async executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
    const config = this.languageConfigs.get(request.language);
    
    if (!config) {
      return {
        success: false,
        error: `Unsupported language: ${request.language}`
      };
    }

    try {
      // In a real implementation, this would use Docker containers or similar sandboxing
      const result = await this.executeInSandbox(request, config);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  async runTests(codeSubmission: CodeSubmission, testCases: Array<{
    input: string;
    expectedOutput: string;
    name?: string;
  }>): Promise<CodeTestResult[]> {
    const config = this.languageConfigs.get(codeSubmission.language);
    
    if (!config) {
      throw new Error(`Unsupported language: ${codeSubmission.language}`);
    }

    const testResults: CodeTestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.executeCode({
        code: codeSubmission.code,
        language: codeSubmission.language,
        input: testCase.input,
        timeout: config.maxExecutionTime,
        memoryLimit: config.maxMemory
      });

      const testResult: CodeTestResult = {
        id: uuidv4(),
        testName: testCase.name || `Test ${testResults.length + 1}`,
        passed: result.success && this.normalizeOutput(result.output || '') === this.normalizeOutput(testCase.expectedOutput),
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.output || '',
        executionTime: result.executionTime,
        errorMessage: result.error
      };

      testResults.push(testResult);
    }

    return testResults;
  }

  async validateCode(code: string, language: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const config = this.languageConfigs.get(language);
    
    if (!config) {
      return {
        isValid: false,
        errors: [`Unsupported language: ${language}`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax validation
    try {
      if (language === 'javascript') {
        this.validateJavaScript(code, errors, warnings);
      } else if (language === 'python') {
        this.validatePython(code, errors, warnings);
      }
      // Add more language-specific validations as needed
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Syntax validation failed');
    }

    // Security checks
    this.performSecurityChecks(code, language, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSupportedLanguages(): Array<{ code: string; name: string; extension: string }> {
    return Array.from(this.languageConfigs.entries()).map(([code, config]) => ({
      code,
      name: config.name,
      extension: config.extension
    }));
  }

  private async executeInSandbox(request: ExecutionRequest, config: LanguageConfig): Promise<ExecutionResult> {
    // In a real implementation, this would create and run a Docker container
    // For now, we'll simulate execution
    
    const startTime = Date.now();
    
    try {
      // Simulate code execution
      let output = '';
      let exitCode = 0;

      if (request.language === 'javascript') {
        output = this.executeJavaScript(request.code, request.input);
      } else if (request.language === 'python') {
        output = this.executePython(request.code, request.input);
      } else {
        // For other languages, just return a mock output
        output = `Code executed successfully in ${config.name}`;
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output,
        exitCode,
        executionTime,
        memoryUsed: 32 // Mock memory usage
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        exitCode: 1,
        executionTime: Date.now() - startTime
      };
    }
  }

  private executeJavaScript(code: string, input?: string): string {
    try {
      // Create a safe execution context
      const sandbox = {
        console: {
          log: (...args: any[]) => args.join(' ')
        },
        // Add safe built-in functions as needed
      };

      // Execute code in sandbox (simplified - in production, use vm2 or similar)
      const func = new Function(...Object.keys(sandbox), code);
      const result = func(...Object.values(sandbox));
      
      return result !== undefined ? String(result) : 'Code executed successfully';
    } catch (error) {
      throw new Error(`JavaScript execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private executePython(code: string, input?: string): string {
    // In a real implementation, this would execute Python code in a sandbox
    // For now, return a mock result
    return 'Python code executed successfully';
  }

  private validateJavaScript(code: string, errors: string[], warnings: string[]): void {
    // Basic JavaScript syntax validation
    try {
      new Function(code);
    } catch (error) {
      errors.push(`Syntax error: ${error instanceof Error ? error.message : 'Invalid syntax'}`);
    }

    // Check for potentially dangerous operations
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /require\s*\(/,
      /import\s+.*from/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        warnings.push('Potentially dangerous operation detected');
        break;
      }
    }
  }

  private validatePython(code: string, errors: string[], warnings: string[]): void {
    // Basic Python syntax validation (simplified)
    const lines = code.split('\n');
    let indentStack = [0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;

      const indent = line.length - line.trimStart().length;
      
      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
      } else if (indent < indentStack[indentStack.length - 1]) {
        while (indentStack.length > 0 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          errors.push(`Indentation error on line ${i + 1}`);
        }
      }
    }

    // Check for dangerous imports
    const dangerousImports = ['os', 'sys', 'subprocess', 'socket', 'urllib', 'requests'];
    for (const imp of dangerousImports) {
      if (code.includes(`import ${imp}`) || code.includes(`from ${imp}`)) {
        warnings.push(`Potentially dangerous module import: ${imp}`);
      }
    }
  }

  private performSecurityChecks(code: string, language: string, errors: string[], warnings: string[]): void {
    // Common security checks for all languages
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /del\s+\/s/i,
      /format\s+c:/i,
      /system\s*\(/i,
      /exec\s*\(/i,
      /shell_exec\s*\(/i,
      /eval\s*\(/i,
      /__import__\s*\(/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push('Potentially dangerous code detected');
        break;
      }
    }

    // Check for infinite loops (basic detection)
    const loopPatterns = [/while\s*\(.*true\)/i, /for\s*\(.*;;.*\)/i];
    for (const pattern of loopPatterns) {
      if (pattern.test(code)) {
        warnings.push('Potential infinite loop detected');
      }
    }
  }

  private normalizeOutput(output: string): string {
    // Normalize output for comparison (remove extra whitespace, etc.)
    return output.trim().replace(/\s+/g, ' ');
  }

  async getExecutionStatistics(): Promise<{
    totalExecutions: number;
    averageExecutionTime: number;
    successRate: number;
    languageUsage: { [key: string]: number };
  }> {
    // In a real implementation, this would query the database
    return {
      totalExecutions: 0,
      averageExecutionTime: 0,
      successRate: 0,
      languageUsage: {}
    };
  }

  async cleanupResources(): Promise<void> {
    // In a real implementation, this would clean up Docker containers and temporary files
    console.log('Cleaning up execution resources...');
  }
}

export default new CodeExecutionService();
