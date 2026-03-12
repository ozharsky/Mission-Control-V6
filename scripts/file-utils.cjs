/**
 * File Utilities Module
 * 
 * Provides async file operations with locking and rotation
 * to prevent race conditions and unbounded file growth.
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync, mkdirSync } = require('fs');

// Simple in-memory lock for file operations
const fileLocks = new Map();

/**
 * Acquire lock on a file path
 */
async function acquireLock(filePath) {
  while (fileLocks.has(filePath)) {
    await delay(10);
  }
  fileLocks.set(filePath, true);
}

/**
 * Release lock on a file path
 */
function releaseLock(filePath) {
  fileLocks.delete(filePath);
}

/**
 * Ensure directory exists (creates parents if needed)
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    // Create with recursive: true to ensure parent dirs exist
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Read JSON file with locking
 */
async function readJsonFile(filePath, defaultValue = null) {
  await acquireLock(filePath);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return defaultValue;
    }
    throw e;
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Write JSON file with locking
 */
async function writeJsonFile(filePath, data) {
  // Ensure parent directory exists
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  
  await acquireLock(filePath);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Append to JSON array file with rotation
 * Rotates file when it exceeds maxSize (in bytes)
 */
async function appendJsonToFile(filePath, item, options = {}) {
  const { maxSize = 10 * 1024 * 1024, maxBackups = 3 } = options; // 10MB default
  
  await acquireLock(filePath);
  try {
    let data = [];
    try {
      const content = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(content);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    
    // Add new item
    data.push(item);
    
    // Check if rotation needed
    const jsonString = JSON.stringify(data, null, 2);
    if (Buffer.byteLength(jsonString, 'utf8') > maxSize) {
      await rotateFile(filePath, maxBackups);
      // Keep only recent items after rotation
      const keepCount = Math.floor(data.length * 0.5); // Keep last 50%
      data = data.slice(-keepCount);
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Rotate a file (create .1, .2, etc. backups)
 */
async function rotateFile(filePath, maxBackups) {
  // Rotate existing backups
  for (let i = maxBackups - 1; i >= 1; i--) {
    const oldPath = `${filePath}.${i}`;
    const newPath = `${filePath}.${i + 1}`;
    try {
      await fs.rename(oldPath, newPath);
    } catch (e) {
      // File doesn't exist, skip
    }
  }
  
  // Move main file to .1
  try {
    await fs.rename(filePath, `${filePath}.1`);
  } catch (e) {
    // Main file doesn't exist, skip
  }
}

/**
 * Read JSON file synchronously (for backwards compatibility)
 * Only use this during startup, not in hot paths
 */
function readJsonFileSync(filePath, defaultValue = null) {
  try {
    const data = require('fs').readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return defaultValue;
    }
    throw e;
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  ensureDir,
  readJsonFile,
  writeJsonFile,
  appendJsonToFile,
  readJsonFileSync,
  rotateFile,
  delay
};