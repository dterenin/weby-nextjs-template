// ts-morph-fixer.ts - Complete TypeScript solution with memory leak fixes
import { Project, SourceFile, Node, ImportDeclaration, SyntaxKind, ts, Identifier, Diagnostic } from "ts-morph";
import path from "node:path";
import fs from "node:fs";

// Enhanced type definitions for better type safety
interface ExportInfo {
  path: string;
  isDefault: boolean;
  // MEMORY FIX: Remove sourceFile reference to prevent circular references
  // sourceFile?: SourceFile; // Removed to prevent memory leaks
}

interface PreprocessResult {
  content: string;
  wasChanged: boolean;
  changes: string[];
}

interface DiagnosticFix {
  code: number;
  message: string;
  applied: boolean;
  description: string;
}

interface FixerConfig {
  projectPath: string;
  specificFiles: string[];
  buildOutput?: string;
  skipPreprocessing?: boolean;
  verboseLogging?: boolean;
  // MEMORY FIX: Add memory management options
  maxFilesPerBatch?: number;
  enableMemoryOptimization?: boolean;
}

interface FixerStats {
  filesProcessed: number;
  importsFixed: number;
  exportsRefactored: number;
  diagnosticsResolved: number;
  // MEMORY FIX: Add memory usage tracking
  memoryUsageMB?: number;
}

interface FixerOptions {
  // Preprocessing options
  stripMarkdown?: boolean;
  addUseClient?: boolean;
  customClientIndicators?: RegExp[];
  
  // Import fixing options
  enforceNamedExports?: boolean;
  componentsToRefactor?: string[];
  specialImportCases?: Record<string, string>;
  
  // Performance options
  batchSize?: number;
  maxConcurrency?: number;
  enableCaching?: boolean;
  
  // Logging options
  verboseLogging?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_OPTIONS: Required<FixerOptions> = {
  stripMarkdown: true,
  addUseClient: true,
  customClientIndicators: [],
  enforceNamedExports: true,
  componentsToRefactor: [
    "src/components/header.tsx",
    "src/components/footer.tsx", 
    "src/components/hero.tsx"
  ],
  specialImportCases: {
    'cn': '@/lib/utils'
  },
  batchSize: 50,
  maxConcurrency: 4,
  enableCaching: true,
  verboseLogging: false,
  logLevel: 'info'
};

// MEMORY FIX: Use WeakMap instead of global Map to allow garbage collection
const exportMapCache = new WeakMap<Project, Map<string, ExportInfo>>();

/**
 * MEMORY FIX: Helper function to get or create export map for a project
 * This prevents global state accumulation
 */
function getExportMap(project: Project): Map<string, ExportInfo> {
  let exportMap = exportMapCache.get(project);
  if (!exportMap) {
    exportMap = new Map<string, ExportInfo>();
    exportMapCache.set(project, exportMap);
  }
  return exportMap;
}

/**
 * MEMORY FIX: Helper function to clear export map for a project
 */
function clearExportMap(project: Project): void {
  const exportMap = exportMapCache.get(project);
  if (exportMap) {
    exportMap.clear();
    exportMapCache.delete(project);
  }
}

/**
 * Pre-processing functions migrated from Python script
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
 * Pass 1: Proactively refactors key components (like Header/Footer/Hero) to use named exports.
 * This enforces a consistent style at the source and prevents import/export mismatches.
 */
function enforceNamedExports(project: Project) {
  console.log("  - [Pass 1] Enforcing named exports for key components...");
  
  // Extended list to include hero.tsx which was causing the build error
  const componentsToRefactor = [
    "src/components/header.tsx", 
    "src/components/footer.tsx",
    "src/components/hero.tsx"  // Added hero.tsx to fix the build error
  ];
  
  for (const relativePath of componentsToRefactor) {
    const sourceFile = project.getSourceFile(sf => sf.getFilePath().endsWith(relativePath));
    if (!sourceFile) continue;

    const exportAssignment = sourceFile.getExportAssignment(e => !e.isExportEquals());
    if (!exportAssignment) continue;
    
    const expression = exportAssignment.getExpression();
    if (!Node.isIdentifier(expression)) continue;

    const exportName = expression.getText();
    console.log(`    - 🔄 Refactoring '${exportName}' in ${relativePath} to a named export.`);
    
    // MEMORY FIX: Limit the scope of reference finding to prevent memory buildup
    try {
      // Find all references to this export and update imports
      const referencedSymbols = expression.findReferences();
      for (const referencedSymbol of referencedSymbols) {
        for (const reference of referencedSymbol.getReferences()) {
          const node = reference.getNode();
          const importClause = node.getParentIfKind(SyntaxKind.ImportClause);
          if (importClause && importClause.getDefaultImport()?.getText() === exportName) {
            const importDeclaration = importClause.getParentIfKindOrThrow(SyntaxKind.ImportDeclaration);
            const existingNamed = importDeclaration.getNamedImports().map(ni => ni.getName());
            const newNamed = [...existingNamed, exportName].sort();
            importDeclaration.removeDefaultImport();
            importDeclaration.addNamedImports(newNamed);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Could not process references for ${exportName}: ${error}`);
    }

    // Convert the declaration to a named export
    const declaration = expression.getSymbolOrThrow().getDeclarations()[0];
    if (Node.isVariableDeclaration(declaration)) {
      const varStatement = declaration.getParent().getParent();
      if (Node.isVariableStatement(varStatement)) varStatement.setIsExported(true);
    } else if (Node.isFunctionDeclaration(declaration) || Node.isClassDeclaration(declaration)) {
      declaration.setIsExported(true);
    }
    
    // Remove the default export statement
    exportAssignment.remove();
  }
}

/**
 * Pass 2: Build a comprehensive map of all available exports in the project.
 * This is essential for fixing completely missing imports (TS2304 errors).
 * MEMORY FIX: Use project-scoped export map instead of global
 */
function buildExportMap(project: Project) {
  console.log("  - [Pass 2] Building project-wide export map...");
  const exportMap = getExportMap(project);
  exportMap.clear(); // Clear any existing data

  // MEMORY FIX: Process files in smaller batches to prevent memory spikes
  const sourceFiles = project.getSourceFiles().filter(sf => 
    !sf.getFilePath().includes("/node_modules/") && 
    !sf.isDeclarationFile() &&
    sf.getFilePath().includes('/src/')
  );

  const batchSize = 25; // Reduced batch size for better memory management
  for (let i = 0; i < sourceFiles.length; i += batchSize) {
    const batch = sourceFiles.slice(i, i + batchSize);
    
    batch.forEach(sourceFile => {
      try {
        const filePath = sourceFile.getFilePath();
        console.log(`    - Checking file: ${filePath}`);
        
        // Calculate the module specifier for imports (@/...)
        const srcIndex = filePath.indexOf('/src/');
        const relativePath = filePath.substring(srcIndex + 5).replace(/\.(ts|tsx)$/, '').replace(/\\/g, '/');
        const moduleSpecifier = `@/${relativePath.replace(/\/index$/, '')}`;
        
        console.log(`    - Processing file: ${filePath}`);
        console.log(`    - Module specifier: ${moduleSpecifier}`);
        
        // Handle default exports
        const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
        if (defaultExportSymbol) {
          let exportName = defaultExportSymbol.getAliasedSymbol()?.getName() ?? defaultExportSymbol.getName();
          // If the export name is 'default', derive it from the filename
          if (exportName === 'default') {
            const baseName = sourceFile.getBaseNameWithoutExtension();
            exportName = (baseName !== 'index') 
              ? (baseName.charAt(0).toUpperCase() + baseName.slice(1)) 
              : (path.basename(path.dirname(sourceFile.getFilePath())).charAt(0).toUpperCase() + path.basename(path.dirname(sourceFile.getFilePath())).slice(1));
          }
          if (!exportMap.has(exportName)) {
            // MEMORY FIX: Don't store sourceFile reference to prevent circular references
            exportMap.set(exportName, { path: moduleSpecifier, isDefault: true });
            console.log(`    - Added default export: ${exportName}`);
          }
        }
        
        // Handle named exports
        const exportSymbols = sourceFile.getExportSymbols();
        exportSymbols.forEach(symbol => {
          const name = symbol.getName();
          if (name !== "default" && !exportMap.has(name)) {
            // MEMORY FIX: Don't store sourceFile reference to prevent circular references
            exportMap.set(name, { path: moduleSpecifier, isDefault: false });
            console.log(`    - Added named export: ${name}`);
          }
        });
      } catch (error) {
        console.warn(`⚠️  Warning: Failed to process file ${sourceFile.getBaseName()}: ${error}`);
      }
    });
    
    // MEMORY FIX: Force garbage collection between batches if available
    if (global.gc) {
      global.gc();
    }
  }
  
  console.log(`  - [Pass 2] Export map built. Found ${exportMap.size} unique potential imports.`);
  if (exportMap.size === 0) {
    console.log(`  - [Pass 2] WARNING: No exports found! This might indicate a problem with file indexing.`);
  }
}

/**
 * Pass 3: Fix import-related errors based on TypeScript diagnostics.
 * This handles various import/export mismatch scenarios.
 * MEMORY FIX: Limit diagnostic processing to prevent memory buildup
 */
function fixImportsBasedOnDiagnostics(sourceFile: SourceFile, project: Project) {
  console.log(`  - [Pass 3] Fixing imports in ${path.basename(sourceFile.getFilePath())} based on diagnostics...`);
  
  // MEMORY FIX: Limit the number of diagnostics processed to prevent memory issues
  const diagnostics = sourceFile.getPreEmitDiagnostics().slice(0, 50); // Limit to first 50 diagnostics
  if (diagnostics.length === 0) {
    console.log("    - No diagnostics found. Skipping.");
    return;
  }

  const exportMap = getExportMap(project);
  let changesMade = false;
  
  for (const diagnostic of diagnostics) {
    try {
      const code = diagnostic.getCode();
      const messageText = diagnostic.getMessageText();
      
      console.log(`    - Processing diagnostic ${code}: ${messageText}`);
      
      // CASE 1: Module has no default export, suggests using named import
      if (code === 2613 && typeof messageText === 'string') {
          const match = messageText.match(/Did you mean to use 'import \{ ([^}]+) \} from "([^"]+)"'/);
          if (match) {
              const importName = match[1];
              const fullModuleSpecifier = match[2];
              
              const moduleSpecifier = fullModuleSpecifier.includes('@/') 
                  ? fullModuleSpecifier 
                  : '@/components/header';
              
              const importDeclaration = sourceFile.getImportDeclaration(d => 
                  d.getModuleSpecifier().getLiteralValue().includes('header') || 
                  d.getModuleSpecifier().getLiteralValue() === moduleSpecifier
              );
              
              if (importDeclaration && importDeclaration.getDefaultImport()) {
                  console.log(`    - 🛠️  Fixing incorrect default import for '${importName}' (TS2613).`);
                  importDeclaration.removeDefaultImport();
                  importDeclaration.addNamedImport(importName);
                  changesMade = true;
              }
          }
      }

      // CASE 2: Cannot find name - missing import
      if (code === 2304 && typeof messageText === 'string') {
          const match = messageText.match(/'([^']+)'/);
          if (match) {
              const importName = match[1];
              console.log(`    - Looking for missing import: ${importName}`);
              
              // Special case for utility functions
              if (importName === 'cn') {
                  console.log(`    - 🎯 Adding special case: 'cn' from '@/lib/utils' (TS2304).`);
                  sourceFile.addImportDeclaration({ moduleSpecifier: '@/lib/utils', namedImports: ['cn'] });
                  changesMade = true;
                  continue;
              }

              // Look up in the export map
              const exportInfo = exportMap.get(importName);
              if (exportInfo) {
                  console.log(`    - ✅ Adding missing import for '${importName}' from '${exportInfo.path}' (TS2304).`);
                  const newImport = sourceFile.addImportDeclaration({ moduleSpecifier: exportInfo.path });
                  if (exportInfo.isDefault) newImport.setDefaultImport(importName);
                  else newImport.addNamedImport(importName);
                  changesMade = true;
              } else {
                  console.log(`    - ❌ Could not find export for '${importName}' in export map.`);
              }
          }
      }

      // CASE 3: Module cannot be found - path resolution issues
      if (code === 2307 && typeof messageText === 'string') {
          const match = messageText.match(/Module '([^']+)'/);
          if (match) {
              const modulePath = match[1];
              console.log(`    - 🔍 Found module resolution error for '${modulePath}' (TS2307).`);
              
              // Fix malformed @/ paths
              if (modulePath.includes('@/../')) {
                  const correctedPath = modulePath.replace('@/../', '@/');
                  const importDeclaration = sourceFile.getImportDeclaration(d => 
                      d.getModuleSpecifier().getLiteralValue() === modulePath
                  );
                  
                  if (importDeclaration) {
                      console.log(`    - 🛠️  Fixing malformed path '${modulePath}' to '${correctedPath}' (TS2307).`);
                      importDeclaration.setModuleSpecifier(correctedPath);
                      changesMade = true;
                  }
              }
          }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Failed to process diagnostic: ${error}`);
    }
  }

  if (!changesMade) {
    console.log("    - No actionable import diagnostics found.");
  }
}

/**
 * Pass 4: Handle Next.js build errors that aren't caught by TypeScript diagnostics.
 * This parses build output and fixes import/export mismatches.
 */
function fixNextJsBuildErrors(project: Project, buildOutput?: string) {
  if (!buildOutput) return;
  
  console.log("  - [Pass 4] Fixing Next.js build errors...");
  
  // Parse "Attempted import error" messages from Next.js build output
  const exportErrors = buildOutput.match(/Attempted import error: '([^']+)' is not exported from '([^']+)'/g);
  
  if (exportErrors) {
    for (const error of exportErrors) {
      const match = error.match(/Attempted import error: '([^']+)' is not exported from '([^']+)'/);
      if (match) {
        const [, importName, modulePath] = match;
        console.log(`    - 🔍 Found Next.js import error: '${importName}' from '${modulePath}'`);
        fixImportExportMismatch(project, importName, modulePath);
      }
    }
  }
}

/**
 * Helper function to fix import/export mismatches detected in build errors.
 */
function fixImportExportMismatch(project: Project, importName: string, modulePath: string) {
  // Find the module file
  const moduleFile = project.getSourceFile(sf => {
    const filePath = sf.getFilePath();
    return filePath.includes(modulePath.replace('@/', 'src/'));
  });
  
  if (!moduleFile) {
    console.log(`    - ❌ Could not find module file for '${modulePath}'`);
    return;
  }
  
  // Check what type of export exists
  const hasDefaultExport = moduleFile.getDefaultExportSymbol();
  const hasNamedExport = moduleFile.getExportSymbols().some(s => s.getName() === importName);
  
  console.log(`    - Module analysis: hasDefault=${!!hasDefaultExport}, hasNamed=${hasNamedExport}`);
  
  if (hasDefaultExport && !hasNamedExport) {
    // The module has a default export but the import expects a named export
    // Fix all files that import from this module
    project.getSourceFiles().forEach(sf => {
      const importDecl = sf.getImportDeclaration(d => 
        d.getModuleSpecifier().getLiteralValue() === modulePath
      );
      
      if (importDecl) {
        const namedImports = importDecl.getNamedImports();
        const targetImport = namedImports.find(ni => ni.getName() === importName);
        
        if (targetImport) {
          console.log(`    - 🛠️  Converting named import '${importName}' to default import in ${path.basename(sf.getFilePath())}`);
          
          // Remove the named import
          targetImport.remove();
          
          // If this was the only named import, remove the entire named imports clause
          if (namedImports.length === 1) {
            importDecl.removeNamedImports();
          }
          
          // Add as default import
          importDecl.setDefaultImport(importName);
        }
      }
    });
  }
}

/**
 * Main controller class for TypeScript project auto-fixing
 * Encapsulates all state and provides a clean API
 * MEMORY FIX: Added proper resource cleanup and memory management
 */
class TypeScriptAutoFixer {
  private project: Project | null = null; // MEMORY FIX: Allow nulling for cleanup
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
      maxFilesPerBatch: config.maxFilesPerBatch || 25, // MEMORY FIX: Default batch size
      enableMemoryOptimization: config.enableMemoryOptimization ?? true
    };
  }

  /**
   * Main entry point for the fixing process
   * MEMORY FIX: Added proper cleanup in finally block
   */
  async fixProject(): Promise<FixerStats> {
    console.log("🚀 Starting Enhanced TypeScript Auto-Fix...");
    
    try {
      await this.preprocessFiles();
      await this.initializeProject();
      await this.executeFixingPasses();
      await this.finalizeChanges();
      
      // MEMORY FIX: Track memory usage
      if (process.memoryUsage) {
        this.stats.memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      }
      
      return this.stats;
    } catch (error) {
      console.error("❌ Auto-fix failed:", error);
      throw error;
    } finally {
      // MEMORY FIX: Ensure cleanup happens even if there's an error
      await this.cleanup();
    }
  }

  /**
   * MEMORY FIX: Proper cleanup method to prevent memory leaks
   */
  private async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up resources...");
    
    if (this.project) {
      // Clear export map for this project
      clearExportMap(this.project);
      
      // Clear project references
      this.project = null;
    }
    
    // Force garbage collection if available
    if (global.gc && this.config.enableMemoryOptimization) {
      global.gc();
    }
  }

  /**
   * Enhanced preprocessing with better error handling and validation
   */
  private async preprocessFiles(): Promise<void> {
    if (this.config.skipPreprocessing) {
      console.log("⏭️  Skipping preprocessing as requested");
      return;
    }

    console.log("\n🐍 Stage 1: Text-based preprocessing...");
    const filesToProcess = await this.getFilesToProcess();
    
    // MEMORY FIX: Process files in smaller batches
    const batchSize = this.config.maxFilesPerBatch || 25;
    let successful = 0;
    
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(filePath => this.preprocessSingleFile(filePath))
      );
      
      successful += results.filter(r => r.status === 'fulfilled').length;
      
      // MEMORY FIX: Force garbage collection between batches
      if (global.gc && this.config.enableMemoryOptimization) {
        global.gc();
      }
    }
    
    console.log(`✅ Preprocessing complete: ${successful}/${filesToProcess.length} files processed`);
    this.stats.filesProcessed = successful;
  }

  /**
   * Get list of files to process
   */
  private async getFilesToProcess(): Promise<string[]> {
    if (this.config.specificFiles.length > 0) {
      return this.config.specificFiles;
    }

    // Scan for files if none specified
    const srcDir = path.join(this.config.projectPath, 'src');
    const extensions = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'];
    const filesToProcess: string[] = [];
    
    try {
      const glob = require('glob');
      for (const ext of extensions) {
        const files = glob.sync(path.join(srcDir, ext));
        filesToProcess.push(...files.filter((f: string) => !f.includes('node_modules')));
      }
    } catch (error) {
      console.log("Warning: glob not available, processing specific files only");
    }

    return filesToProcess;
  }

  /**
   * Preprocess a single file
   */
  private async preprocessSingleFile(filePath: string): Promise<boolean> {
    return preprocessFile(filePath);
  }

  /**
   * Initialize the TypeScript project
   * MEMORY FIX: Added memory optimization options
   */
  private async initializeProject(): Promise<void> {
    console.log("\n🤖 Stage 2: Initializing TypeScript project...");
    
    // MEMORY FIX: Initialize project with memory optimization settings
    this.project = new Project({
      tsConfigFilePath: path.join(this.config.projectPath, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
      // MEMORY FIX: Add compiler options for better memory management
      compilerOptions: {
        skipLibCheck: true, // Skip type checking of declaration files
        skipDefaultLibCheck: true // Skip type checking of default library declaration files
      }
    });
    
    const srcDir = path.join(this.config.projectPath, 'src');
    console.log(`🤖 Indexing all source files in ${srcDir}...`);
    this.project.addSourceFilesAtPaths(`${srcDir}/**/*.{ts,tsx}`);
    
    console.log(`🤖 Found ${this.project.getSourceFiles().length} source files.`);
  }

  /**
   * Execute all fixing passes
   * MEMORY FIX: Added memory monitoring between passes
   */
  private async executeFixingPasses(): Promise<void> {
    if (!this.project) {
      throw new Error("Project not initialized");
    }

    // Pass 1: Enforce named exports
    console.log("🔄 Pass 1: Enforcing named exports...");
    enforceNamedExports(this.project);
    this.logMemoryUsage("After Pass 1");

    // Pass 2: Build export map
    console.log("🗺️  Pass 2: Building export map...");
    buildExportMap(this.project);
    this.logMemoryUsage("After Pass 2");
    
    // Pass 3: Fix imports based on diagnostics
    console.log("🔧 Pass 3: Fixing imports...");
    const sourceFilesToFix = this.config.specificFiles.length > 0 
      ? this.config.specificFiles.map(filePath => this.project!.getSourceFileOrThrow(filePath))
      : this.project.getSourceFiles().filter(sf => 
          !sf.getFilePath().includes('/node_modules/') && 
          !sf.isDeclarationFile()
        );
        
    // MEMORY FIX: Process files in batches
    const batchSize = this.config.maxFilesPerBatch || 25;
    for (let i = 0; i < sourceFilesToFix.length; i += batchSize) {
      const batch = sourceFilesToFix.slice(i, i + batchSize);
      
      for (const sourceFile of batch) {
        try {
          fixImportsBasedOnDiagnostics(sourceFile, this.project);
        } catch (error) {
          console.warn(`⚠️  Warning: Failed to fix imports in ${sourceFile.getBaseName()}: ${error}`);
        }
      }
      
      // MEMORY FIX: Force garbage collection between batches
      if (global.gc && this.config.enableMemoryOptimization) {
        global.gc();
      }
    }
    
    this.logMemoryUsage("After Pass 3");

    // Pass 4: Handle Next.js specific build errors
    console.log("🚀 Pass 4: Fixing Next.js build errors...");
    fixNextJsBuildErrors(this.project, this.config.buildOutput);
    this.logMemoryUsage("After Pass 4");
  }

  /**
   * MEMORY FIX: Helper method to log memory usage
   */
  private logMemoryUsage(stage: string): void {
    if (this.config.verboseLogging && process.memoryUsage) {
      const usage = process.memoryUsage();
      console.log(`📊 ${stage} - Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(usage.rss / 1024 / 1024)}MB RSS`);
    }
  }

  /**
   * Finalize changes and organize imports
   * MEMORY FIX: Process in batches to prevent memory spikes
   */
  private async finalizeChanges(): Promise<void> {
    if (!this.project) {
      throw new Error("Project not initialized");
    }

    console.log("  - [Pass 5] Organizing imports and cleaning up...");
    const sourceFilesToFix = this.config.specificFiles.length > 0 
      ? this.config.specificFiles.map(filePath => this.project!.getSourceFileOrThrow(filePath))
      : this.project.getSourceFiles().filter(sf => 
          !sf.getFilePath().includes('/node_modules/') && 
          !sf.isDeclarationFile()
        );
    
    // MEMORY FIX: Organize imports in batches
    const batchSize = this.config.maxFilesPerBatch || 25;
    for (let i = 0; i < sourceFilesToFix.length; i += batchSize) {
      const batch = sourceFilesToFix.slice(i, i + batchSize);
      
      for (const sourceFile of batch) {
        try {
          sourceFile.organizeImports();
        } catch (error) {
          console.warn(`⚠️  Warning: Failed to organize imports in ${sourceFile.getBaseName()}: ${error}`);
        }
      }
    }

    console.log("🤖 Saving all changes...");
    await this.project.save();
  }
}

/**
 * Backward-compatible main function that preserves existing API
 * while using the new enhanced architecture internally
 * MEMORY FIX: Added proper cleanup and error handling
 */
async function fixProject(
  projectPath: string, 
  specificFilePaths: string[], 
  buildOutput?: string
): Promise<void> {
  console.log("🚀 Starting Hybrid Auto-Fix for TypeScript project...");
  
  // MEMORY FIX: Use the new TypeScriptAutoFixer class with proper cleanup
  const fixer = new TypeScriptAutoFixer({
    projectPath,
    specificFiles: specificFilePaths,
    buildOutput,
    enableMemoryOptimization: true,
    maxFilesPerBatch: 25
  });
  
  try {
    const stats = await fixer.fixProject();
    console.log(`✅ Hybrid Auto-Fix complete! Stats:`, stats);
  } catch (error) {
    console.error("❌ Auto-fix failed:", error);
    throw error;
  }
}

// --- Main execution block ---
const projectDirectory = process.argv[2];
const specificFiles = process.argv.slice(3);

// Check for build output flag
const buildErrorsFlag = process.argv.includes('--build-errors');
let buildOutput: string | undefined;

if (buildErrorsFlag) {
  // Read build output from stdin when --build-errors flag is present
  const chunks: Buffer[] = [];
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    buildOutput = Buffer.concat(chunks).toString();
    runFixer();
  });
} else {
  runFixer();
}

function runFixer() {
  if (!projectDirectory) {
    console.error("❌ [TS] Error: Project directory path is required as the first argument.");
    process.exit(1);
  }

  fixProject(path.resolve(projectDirectory), specificFiles, buildOutput).catch((err) => {
    console.error("❌ [TS] An unexpected error occurred:", err);
    process.exit(1);
  });
}
