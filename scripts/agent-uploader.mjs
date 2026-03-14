/**
 * Agent File Uploader
 * Mission Control V6
 * 
 * Usage:
 *   node agent-uploader.mjs <file-path> [options]
 * 
 * Options:
 *   --category=<category>   File category (default: 'agents')
 *   --projectId=<id>        Associated project ID
 *   --agentId=<id>          Agent identifier
 *   --metadata=<json>       Additional metadata as JSON string
 * 
 * Environment Variables:
 *   AGENT_API_KEY           API key for authentication
 *   MC_UPLOAD_URL           Upload endpoint URL
 * 
 * Example:
 *   node agent-uploader.mjs ./report.pdf --category=reports --agentId=architect
 */

import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

const API_KEY = process.env.AGENT_API_KEY || 'your-api-key-here';
const UPLOAD_URL = process.env.MC_UPLOAD_URL || 'https://mission-control-v6-kappa.vercel.app/api/upload';

async function uploadFile(filePath, options = {}) {
  try {
    // Read file
    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Detect content type
    const fileType = await fileTypeFromBuffer(buffer);
    const contentType = fileType?.mime || 'application/octet-stream';
    
    // Convert to base64
    const fileData = buffer.toString('base64');
    
    // Prepare payload
    const payload = {
      fileData,
      fileName,
      contentType,
      category: options.category || 'agents',
      projectId: options.projectId || null,
      agentId: options.agentId || 'unknown',
      metadata: options.metadata || {},
    };
    
    // Upload
    console.log(`Uploading ${fileName}...`);
    
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Upload successful!');
      console.log(`   File ID: ${result.file.id}`);
      console.log(`   URL: ${result.file.url}`);
      console.log(`   Size: ${(result.file.size / 1024).toFixed(2)} KB`);
      return result.file;
    } else {
      console.error('❌ Upload failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const filePath = args[0];

if (!filePath) {
  console.log('Usage: node agent-uploader.mjs <file-path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --category=<category>   File category');
  console.log('  --projectId=<id>        Project ID');
  console.log('  --agentId=<id>          Agent identifier');
  console.log('');
  console.log('Environment:');
  console.log('  AGENT_API_KEY           API key');
  console.log('  MC_UPLOAD_URL           Upload endpoint');
  process.exit(1);
}

const options = {};
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--category=')) {
    options.category = arg.split('=')[1];
  } else if (arg.startsWith('--projectId=')) {
    options.projectId = arg.split('=')[1];
  } else if (arg.startsWith('--agentId=')) {
    options.agentId = arg.split('=')[1];
  } else if (arg.startsWith('--metadata=')) {
    try {
      options.metadata = JSON.parse(arg.split('=')[1]);
    } catch (e) {
      console.error('Invalid metadata JSON');
      process.exit(1);
    }
  }
}

uploadFile(filePath, options);
