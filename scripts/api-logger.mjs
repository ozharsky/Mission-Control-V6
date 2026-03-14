#!/usr/bin/env node
/**
 * API Logger with Auto Token/Cost Tracking
 * Wrapper for log-activity.mjs that captures API usage automatically
 * 
 * Usage:
 *   source api-logger.sh && log_api_call <agent-id> "Description" <tokens> [cost-per-1k]
 * 
 * Or in Node.js:
 *   import { logAPICall } from './api-logger.mjs'
 *   await logAPICall('inventor', 'Generated description', 2500, 0.03)
 */

const { execSync } = require('child_process');
const path = require('path');

// Cost per 1K tokens by model
const MODEL_PRICING = {
  'gpt-4': 0.03,
  'gpt-4-turbo': 0.01,
  'gpt-3.5-turbo': 0.0015,
  'claude-3-opus': 0.015,
  'claude-3-sonnet': 0.003,
  'claude-3-haiku': 0.00025,
  'kimi-k2': 0.03,
  'default': 0.03
};

/**
 * Log an API call with automatic cost calculation
 * @param {string} agentId - Agent identifier
 * @param {string} description - What the API call did
 * @param {number} tokens - Total tokens used
 * @param {number|string} modelOrCost - Model name or cost per 1K tokens
 */
function logAPICall(agentId, description, tokens, modelOrCost = 'default') {
  const costPer1K = typeof modelOrCost === 'number' 
    ? modelOrCost 
    : (MODEL_PRICING[modelOrCost] || MODEL_PRICING.default);
  
  const cost = (tokens / 1000) * costPer1K;
  
  const metadata = JSON.stringify({
    tokens: tokens,
    cost: parseFloat(cost.toFixed(4))
  });
  
  const scriptPath = path.join(__dirname, 'log-activity.mjs');
  const cmd = `node "${scriptPath}" "${agentId}" api_call "${description}" api_call '${metadata}'`;
  
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ Logged: ${tokens} tokens, $${cost.toFixed(4)}`);
  } catch (error) {
    console.error('❌ Failed to log API call:', error.message);
    process.exit(1);
  }
}

/**
 * Extract token usage from OpenAI response
 * @param {Object} response - OpenAI API response
 * @returns {number} Total tokens
 */
function extractOpenAITokens(response) {
  return response?.usage?.total_tokens || 0;
}

/**
 * Extract token usage from Claude response
 * @param {Object} response - Claude API response
 * @returns {number} Total tokens
 */
function extractClaudeTokens(response) {
  const usage = response?.usage;
  if (!usage) return 0;
  return (usage.input_tokens || 0) + (usage.output_tokens || 0);
}

/**
 * Extract token usage from Kimi response
 * @param {Object} response - Kimi API response
 * @returns {number} Total tokens
 */
function extractKimiTokens(response) {
  return response?.usage?.total_tokens || 0;
}

// CLI usage
if (require.main === module) {
  const [,, agentId, description, tokens, modelOrCost] = process.argv;
  
  if (!agentId || !description || !tokens) {
    console.log('Usage: node api-logger.mjs <agent-id> "Description" <tokens> [model|cost-per-1k]');
    console.log('');
    console.log('Examples:');
    console.log('  node api-logger.mjs inventor "Generated description" 2500 gpt-4');
    console.log('  node api-logger.mjs writer "Drafted copy" 1800 0.03');
    console.log('  node api-logger.mjs analyst "Analyzed data" 3200 claude-3-sonnet');
    console.log('');
    console.log('Available models:');
    Object.entries(MODEL_PRICING).forEach(([model, cost]) => {
      console.log(`  ${model}: $${cost}/1K tokens`);
    });
    process.exit(1);
  }
  
  logAPICall(agentId, description, parseInt(tokens), modelOrCost);
}

module.exports = {
  logAPICall,
  extractOpenAITokens,
  extractClaudeTokens,
  extractKimiTokens,
  MODEL_PRICING
};
