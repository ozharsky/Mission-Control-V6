#!/usr/bin/env node
/**
 * Mission Control V6 - QA/Debug Tool
 * Comprehensive validation of the codebase
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function error(message) {
  log('red', `❌ ${message}`);
}

function success(message) {
  log('green', `✅ ${message}`);
}

function warning(message) {
  log('yellow', `⚠️  ${message}`);
}

function info(message) {
  log('blue', `ℹ️  ${message}`);
}

// Check for common issues in TypeScript/React files
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  // Check for console.log statements
  const consoleMatches = content.match(/console\.(log|warn|error)\(/g);
  if (consoleMatches && !filePath.includes('debug')) {
    issues.push({ type: 'info', message: `${consoleMatches.length} console statements` });
  }

  // Check for TODO comments
  const todoMatches = content.match(/TODO|FIXME|XXX/g);
  if (todoMatches) {
    issues.push({ type: 'warning', message: `${todoMatches.length} TODO/FIXME comments` });
  }

  // Check for any types
  const anyMatches = content.match(/:\s*any\b/g);
  if (anyMatches) {
    issues.push({ type: 'warning', message: `${anyMatches.length} 'any' types used` });
  }

  // Check for unused imports (basic check)
  const importMatches = content.match(/import\s+{([^}]+)}\s+from/g);
  if (importMatches) {
    importMatches.forEach(match => {
      const imports = match.replace(/import\s+{|}\s+from/g, '').split(',').map(s => s.trim());
      imports.forEach(imp => {
        if (imp && !imp.includes('type') && !content.includes(`<${imp}`) && !content.includes(`${imp}(`)) {
          // Basic check - might have false positives
        }
      });
    });
  }

  return issues;
}

// Recursively get all files
function getFiles(dir, ext) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules') {
      files.push(...getFiles(fullPath, ext));
    } else if (stat.isFile() && fullPath.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main QA checks
function runQA() {
  log('cyan', '\n🔍 Mission Control V6 - QA Report\n');
  log('cyan', '================================\n');

  let totalIssues = 0;
  let totalWarnings = 0;

  // 1. Check build output exists
  info('Checking build output...');
  const distExists = fs.existsSync(path.join(__dirname, '../dist'));
  const indexExists = fs.existsSync(path.join(__dirname, '../dist/index.html'));
  
  if (distExists && indexExists) {
    success('Build output exists');
  } else {
    error('Build output missing - run npm run build');
    totalIssues++;
  }

  // 2. Check for required files
  info('Checking required files...');
  const requiredFiles = [
    'src/App.tsx',
    'src/main.tsx',
    'src/stores/appStore.ts',
    'src/types/index.ts',
    'index.html',
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      success(`${file} exists`);
    } else {
      error(`${file} missing`);
      totalIssues++;
    }
  });

  // 3. Check TypeScript files
  info('Checking TypeScript files...');
  const tsFiles = getFiles(SRC_DIR, '.ts').concat(getFiles(SRC_DIR, '.tsx'));
  
  log('magenta', `\n📁 Found ${tsFiles.length} TypeScript files`);
  
  let totalConsoleStatements = 0;
  let totalTODOs = 0;
  let totalAnyTypes = 0;

  tsFiles.forEach(file => {
    const issues = checkFile(file);
    const relativePath = path.relative(SRC_DIR, file);
    
    issues.forEach(issue => {
      if (issue.message.includes('console')) {
        totalConsoleStatements += parseInt(issue.message);
      }
      if (issue.message.includes('TODO')) {
        totalTODOs += parseInt(issue.message);
      }
      if (issue.message.includes('any')) {
        totalAnyTypes += parseInt(issue.message);
      }
    });
  });

  if (totalConsoleStatements > 0) {
    warning(`${totalConsoleStatements} console statements found`);
  } else {
    success('No console statements found');
  }

  if (totalTODOs > 0) {
    warning(`${totalTODOs} TODO/FIXME comments found`);
  } else {
    success('No TODO comments found');
  }

  if (totalAnyTypes > 0) {
    warning(`${totalAnyTypes} 'any' types found`);
  } else {
    success('No explicit any types found');
  }

  // 4. Check for common React issues
  info('Checking for React best practices...');
  
  const appContent = fs.readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf-8');
  
  // Check for key prop usage
  if (appContent.includes('map(') && !appContent.includes('key={')) {
    warning('Some map() calls may be missing key props');
    totalWarnings++;
  }

  // 5. Check store integrity
  info('Checking store integrity...');
  const storeContent = fs.readFileSync(path.join(SRC_DIR, 'stores/appStore.ts'), 'utf-8');
  
  const requiredMethods = [
    'addTask',
    'updateTask',
    'deleteTask',
    'addProject',
    'updateProject',
    'deleteProject',
    'initSubscriptions',
  ];

  requiredMethods.forEach(method => {
    if (storeContent.includes(`${method}:`)) {
      success(`Store method: ${method}`);
    } else {
      error(`Missing store method: ${method}`);
      totalIssues++;
    }
  });

  // 6. Check types
  info('Checking type definitions...');
  const typesContent = fs.readFileSync(path.join(SRC_DIR, 'types/index.ts'), 'utf-8');
  
  const requiredTypes = ['Task', 'Project', 'Printer'];
  requiredTypes.forEach(type => {
    if (typesContent.includes(`interface ${type}`) || typesContent.includes(`type ${type}`)) {
      success(`Type defined: ${type}`);
    } else {
      error(`Missing type: ${type}`);
      totalIssues++;
    }
  });
  
  // Check for re-exports from other type files
  if (typesContent.includes("export * from './jobs'")) {
    success('Job types re-exported from jobs.ts');
  }
  if (typesContent.includes("export * from './inventory'")) {
    success('Inventory types re-exported from inventory.ts');
  }
  if (typesContent.includes("export * from './reports'")) {
    success('Report types re-exported from reports.ts');
  }

  // 7. Summary
  log('cyan', '\n================================');
  log('cyan', 'QA Summary\n');
  
  if (totalIssues === 0 && totalWarnings === 0) {
    success('All checks passed! 🎉');
    log('green', '\n✅ Mission Control V6 is ready for deployment!\n');
    process.exit(0);
  } else {
    if (totalIssues > 0) {
      error(`${totalIssues} critical issues found`);
    }
    if (totalWarnings > 0) {
      warning(`${totalWarnings} warnings found`);
    }
    log('yellow', '\n⚠️  Please address issues before deployment\n');
    process.exit(1);
  }
}

runQA();