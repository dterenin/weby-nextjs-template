// ts-morph-fixer.ts - Memory-optimized version for high concurrency
import { Project, SourceFile, Node, ImportDeclaration, SyntaxKind, ts, Identifier, Diagnostic } from "ts-morph";
import path from "node:path";
import fs from "node:fs";

// MEMORY FIX: Reduced interfaces and removed unnecessary caching
interface ExportInfo {
  path: string;
  isDefault: boolean;
}

interface FixerConfig {
  projectPath: string;
  specificFiles: string[];
  buildOutput?: string;
  skipPreprocessing?: boolean;
  verboseLogging?: boolean;
  maxFilesPerBatch?: number;
  enableMemoryOptimization?: boolean;
}

interface FixerStats {
  filesProcessed: number;
  importsFixed: number;
  exportsRefactored: number;
  diagnosticsResolved: number;
  memoryUsageMB?: number;
}

// MEMORY FIX: Use simple Map instead of WeakMap for better control
let globalExportMap: Map<string, ExportInfo> | null = null;

/**
 * MEMORY FIX: Force cleanup of all global state
 */
function forceCleanup(): void {
  if (globalExportMap) {
    globalExportMap.clear();
    globalExportMap = null;
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

/**
 * MEMORY FIX: Get or create export map with size limits
 */
function getExportMap(): Map<string, ExportInfo> {
  if (!globalExportMap) {
    globalExportMap = new Map<string, ExportInfo>();
  }
  return globalExportMap;
}

/**
 * Pre-processing functions - optimized for memory
 */
function stripMarkdownFences(content: string): { content: string; wasChanged: boolean } {
  const lines = content.split('\n');
  if (!lines.length) return { content, wasChanged: false };
  
  const fenceIndices = lines
    .map((line, i) => line.trim().startsWith('```') ? i : -1)
    .filter(i => i !== -1);
    
  if (fenceIndices.length >= 2 && fenceIndices[0] < fenceIndices[fenceIndices.length - 1]) {
    const cleanedLines = lines.slice(fenceIndices[0] + 1, fenceIndices[fenceIndices.length - 1]);
    return { content: cleanedLines.join('\n'), wasChanged: true };
  }
  return { content, wasChanged: false };
}

function needsUseClient(content: string): boolean {
  if (/^["']use client["'];?\s*$/m.test(content.trim())) return false;
  
  const clientIndicators = [
    /\buseState\s*\(/,
    /\buseEffect\s*\(/,
    /\bonClick\s*=/,
    /react-hot-toast/,
    /sonner/,
    /@dnd-kit/,
    /embla-carousel-react/,
    /recharts/,
    /cmdk/,
    /input-otp/,
    /react-day-picker/,
    /react-hook-form/,
    /next-themes/,
    /vaul/
  ];
  
  return clientIndicators.some(pattern => pattern.test(content));
}

function addUseClient(content: string): string {
  const lines = content.split('\n');
  const startIndex = lines.length > 0 && lines[0].startsWith('#!') ? 1 : 0;
  lines.splice(startIndex, 0, '"use client";');
  return lines.join('\n');
}

function preprocessFile(filePath: string): boolean {
  try {
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    let content = originalContent;
    let wasChanged = false;

    // Strip Markdown fences
    const { content: strippedContent, wasChanged: stripped } = stripMarkdownFences(content);
    if (stripped) {
      content = strippedContent;
      wasChanged = true;
      console.log(`  - Stripped Markdown from ${path.basename(filePath)}`);
    }

    // Add "use client" if needed
    if (needsUseClient(content)) {
      content = addUseClient(content);
      wasChanged = true;
      console.log(`  - Added 'use client' to ${path.basename(filePath)}`);
    }

    if (wasChanged) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return wasChanged;
  } catch (error) {
    console.log(`  - ❌ Error preprocessing ${path.basename(filePath)}: ${error}`);
    return false;
  }
}

/**
 * MEMORY FIX: Simplified export map building with strict limits
 */
function buildExportMap(project: Project): void {
  console.log("  - [Pass 2] Building project-wide export map...");
  const exportMap = getExportMap();
  exportMap.clear();

  // MEMORY FIX: Process only essential files and limit batch size
  const sourceFiles = project.getSourceFiles()
    .filter(sf => {
      const filePath = sf.getFilePath();
      return !filePath.includes("/node_modules/") && 
             !sf.isDeclarationFile() &&
             filePath.includes('/src/') &&
             (filePath.endsWith('.tsx') || filePath.endsWith('.ts'));
    })
    .slice(0, 20); // MEMORY FIX: Limit to 20 most important files

  sourceFiles.forEach(sourceFile => {
    try {
      const filePath = sourceFile.getFilePath();
      const srcIndex = filePath.indexOf('/src/');
      const relativePath = filePath.substring(srcIndex + 5).replace(/\.(ts|tsx)$/, '').replace(/\\/g, '/');
      const moduleSpecifier = `@/${relativePath.replace(/\/index$/, '')}`;
      
      // Handle default exports - simplified
      const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
      if (defaultExportSymbol) {
        let exportName = defaultExportSymbol.getName();
        if (exportName === 'default') {
          const baseName = sourceFile.getBaseNameWithoutExtension();
          exportName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        }
        if (!exportMap.has(exportName) && exportMap.size < 100) { // MEMORY FIX: Limit map size
          exportMap.set(exportName, { path: moduleSpecifier, isDefault: true });
        }
      }
      
      // Handle named exports - simplified
      const exportSymbols = sourceFile.getExportSymbols();
      exportSymbols.forEach(symbol => {
        const name = symbol.getName();
        if (name !== "default" && !exportMap.has(name) && exportMap.size < 100) { // MEMORY FIX: Limit map size
          exportMap.set(name, { path: moduleSpecifier, isDefault: false });
        }
      });
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to process file ${sourceFile.getBaseName()}: ${error}`);
    }
  });
  
  console.log(`  - [Pass 2] Export map built. Found ${exportMap.size} unique potential imports.`);
}

/**
 * MEMORY FIX: Simplified diagnostic processing with strict limits
 */
function fixImportsBasedOnDiagnostics(sourceFile: SourceFile): void {
  console.log(`  - [Pass 3] Fixing imports in ${path.basename(sourceFile.getFilePath())}...`);
  
  // MEMORY FIX: Process only first 10 diagnostics
  const diagnostics = sourceFile.getPreEmitDiagnostics().slice(0, 10);
  if (diagnostics.length === 0) {
    return;
  }

  const exportMap = getExportMap();
  
  for (const diagnostic of diagnostics) {
    try {
      const code = diagnostic.getCode();
      const messageText = diagnostic.getMessageText();
      
      // CASE 1: Module has no default export
      if (code === 2613 && typeof messageText === 'string') {
        const match = messageText.match(/Did you mean to use 'import \{ ([^}]+) \} from "([^"]+)"'/);
        if (match) {
          const importName = match[1];
          const moduleSpecifier = match[2];
          
          const importDeclaration = sourceFile.getImportDeclaration(d => 
            d.getModuleSpecifier().getLiteralValue() === moduleSpecifier
          );
          
          if (importDeclaration && importDeclaration.getDefaultImport()) {
            importDeclaration.removeDefaultImport();
            importDeclaration.addNamedImport(importName);
          }
        }
      }

      // CASE 2: Cannot find name - missing import
      if (code === 2304 && typeof messageText === 'string') {
        const match = messageText.match(/'([^']+)'/);
        if (match) {
          const importName = match[1];
          
          // Special case for utility functions
          if (importName === 'cn') {
            sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/utils', namedImports: ['cn'] });
            continue;
          }

          // Look up in the export map
          const exportInfo = exportMap.get(importName);
          if (exportInfo) {
            const newImport = sourceFile.addImportDeclaration({ moduleSpecifier: exportInfo.path });
            if (exportInfo.isDefault) {
              newImport.setDefaultImport(importName);
            } else {
              newImport.addNamedImport(importName);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to process diagnostic: ${error}`);
    }
  }
}

/**
 * MEMORY FIX: Simplified main class with aggressive cleanup
 */
class TypeScriptAutoFixer {
  private project: Project | null = null;
  private readonly config: FixerConfig;
  private readonly stats: FixerStats = {
    filesProcessed: 0,
    importsFixed: 0,
    exportsRefactored: 0,
    diagnosticsResolved: 0,
    memoryUsageMB: 0
  };

  constructor(config: FixerConfig) {
    this.config = {
      ...config,
      maxFilesPerBatch: 5, // MEMORY FIX: Very small batches
      enableMemoryOptimization: true
    };
  }

  async fixProject(): Promise<FixerStats> {
    console.log("🚀 Starting Memory-Optimized TypeScript Auto-Fix...");
    
    try {
      await this.preprocessFiles();
      await this.initializeProject();
      await this.executeFixingPasses();
      await this.finalizeChanges();
      
      return this.stats;
    } catch (error) {
      console.error(`❌ Auto-fix failed: ${error}`);
      throw error;
    } finally {
      // MEMORY FIX: Aggressive cleanup
      await this.cleanup();
    }
  }

  private async preprocessFiles(): Promise<void> {
    if (this.config.skipPreprocessing) return;
    
    console.log("📝 Preprocessing files...");
    
    // MEMORY FIX: Process files one by one
    for (const filePath of this.config.specificFiles) {
      if (fs.existsSync(filePath) && (filePath.endsWith('.tsx') || filePath.endsWith('.ts'))) {
        preprocessFile(filePath);
        this.stats.filesProcessed++;
        
        // MEMORY FIX: Force cleanup after each file
        if (global.gc && this.stats.filesProcessed % 3 === 0) {
          global.gc();
        }
      }
    }
  }

  private async initializeProject(): Promise<void> {
    console.log("🔧 Initializing TypeScript project...");
    
    // MEMORY FIX: Minimal project configuration
    this.project = new Project({
      tsConfigFilePath: path.join(this.config.projectPath, "tsconfig.json"),
      skipAddingFilesFromTsConfig: false,
      skipFileDependencyResolution: true, // MEMORY FIX: Skip dependency resolution
      skipLoadingLibFiles: true, // MEMORY FIX: Skip lib files
      useInMemoryFileSystem: false
    });

    // MEMORY FIX: Add only specific files
    this.config.specificFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        this.project!.addSourceFileAtPath(filePath);
      }
    });
  }

  private async executeFixingPasses(): Promise<void> {
    if (!this.project) throw new Error("Project not initialized");
    
    console.log("🔍 Executing fixing passes...");
    
    // Build export map once
    buildExportMap(this.project);
    
    // MEMORY FIX: Process files one by one
    const sourceFiles = this.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      try {
        fixImportsBasedOnDiagnostics(sourceFile);
        
        // MEMORY FIX: Force cleanup after each file
        if (global.gc) {
          global.gc();
        }
      } catch (error) {
        console.warn(`⚠️  Warning: Failed to process ${sourceFile.getBaseName()}: ${error}`);
      }
    }
  }

  private async finalizeChanges(): Promise<void> {
    if (!this.project) return;
    
    console.log("💾 Saving changes...");
    
    try {
      await this.project.save();
      console.log("✅ All changes saved successfully.");
    } catch (error) {
      console.error(`❌ Failed to save changes: ${error}`);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up resources...");
    
    try {
      // MEMORY FIX: Explicit cleanup
      if (this.project) {
        // Clear all source files
        this.project.getSourceFiles().forEach(sf => {
          try {
            this.project!.removeSourceFile(sf);
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        
        this.project = null;
      }
      
      // Clear global state
      forceCleanup();
      
      // MEMORY FIX: Multiple GC calls
      if (global.gc) {
        global.gc();
        setTimeout(() => global.gc && global.gc(), 100);
      }
      
      console.log("✅ Cleanup completed.");
    } catch (error) {
      console.warn(`⚠️  Warning during cleanup: ${error}`);
    }
  }
}

/**
 * MEMORY FIX: Main function with timeout and resource limits
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Usage: node ts-morph-fixer.ts <project-path> <file1> [file2] ...");
    process.exit(1);
  }

  const [projectPath, ...specificFiles] = args;
  
  // MEMORY FIX: Set memory limits
  if (process.env.NODE_OPTIONS && !process.env.NODE_OPTIONS.includes('max-old-space-size')) {
    console.log("⚠️  Warning: Consider setting NODE_OPTIONS='--max-old-space-size=512' for better memory management");
  }
  
  const config: FixerConfig = {
    projectPath,
    specificFiles: specificFiles.filter(f => fs.existsSync(f)),
    verboseLogging: false,
    enableMemoryOptimization: true
  };

  const fixer = new TypeScriptAutoFixer(config);
  
  // MEMORY FIX: Set timeout to prevent hanging
  const timeout = setTimeout(() => {
    console.error("❌ Auto-fix timed out after 60 seconds");
    process.exit(1);
  }, 60000);
  
  try {
    const stats = await fixer.fixProject();
    clearTimeout(timeout);
    
    console.log("\n📊 Auto-fix completed:");
    console.log(`   Files processed: ${stats.filesProcessed}`);
    console.log(`   Imports fixed: ${stats.importsFixed}`);
    console.log(`   Exports refactored: ${stats.exportsRefactored}`);
    console.log(`   Diagnostics resolved: ${stats.diagnosticsResolved}`);
    
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    console.error(`❌ Auto-fix failed: ${error}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ Unhandled error: ${error}`);
    process.exit(1);
  });
}

export { TypeScriptAutoFixer, type FixerConfig, type FixerStats };
