# Agent Activity Logging Guide

## Quick Reference

All agents should log their activities to Mission Control. This helps track:
- What work is being done
- API usage and costs
- Success/failure rates
- Time spent on tasks

---

## Basic Logging

### 1. Simple Task Logging
```bash
node scripts/log-activity.mjs <agent-id> <action> <description> [category]
```

**Examples:**
```bash
# Start a task
node scripts/log-activity.mjs inventor task_start "Designing ZYN dispenser" task

# Complete a task
node scripts/log-activity.mjs inventor task_complete "ZYN dispenser designed" task

# Log a decision
node scripts/log-activity.mjs strategist decision "Prioritized Keychain project" decision

# Log an error
node scripts/log-activity.mjs architect error "Build failed: syntax error" error
```

---

## Logging API Calls (with Tokens/Cost)

### Option A: Use api-logger.mjs (Recommended)
```bash
node scripts/api-logger.mjs <agent-id> "Description" <tokens> <model>
```

**Examples:**
```bash
# Using model name (auto-calculates cost)
node scripts/api-logger.mjs inventor "Generated product description" 2500 gpt-4
node scripts/api-logger.mjs writer "Drafted marketing copy" 1800 claude-3-sonnet
node scripts/api-logger.mjs analyst "Analyzed market data" 3200 kimi-k2

# Using custom cost per 1K tokens
node scripts/api-logger.mjs scout "Research complete" 1500 0.03
```

**Available Models:**
| Model | Cost/1K tokens |
|-------|---------------|
| gpt-4 | $0.03 |
| gpt-4-turbo | $0.01 |
| gpt-3.5-turbo | $0.0015 |
| claude-3-opus | $0.015 |
| claude-3-sonnet | $0.003 |
| claude-3-haiku | $0.00025 |
| kimi-k2 | $0.03 |

### Option B: Manual with Metadata
```bash
node scripts/log-activity.mjs <agent-id> api_call "Description" api_call '{"tokens":1500,"cost":0.045}'
```

---

## Logging File Uploads

```bash
node scripts/log-activity.mjs <agent-id> file_upload "Uploaded STL file" file_upload '{"filename":"product.stl","size":"2.4MB"}'
```

---

## Logging from Code (Node.js)

### Basic Usage
```javascript
const { execSync } = require('child_process');

function logActivity(agentId, action, description, category = 'task', metadata = {}) {
  const meta = JSON.stringify(metadata);
  execSync(`node scripts/log-activity.mjs "${agentId}" "${action}" "${description}" "${category}" '${meta}'`);
}

// Usage
logActivity('inventor', 'task_start', 'Designing product');
```

### With API Tracking
```javascript
const { logAPICall, extractOpenAITokens, extractClaudeTokens } = require('./scripts/api-logger.mjs');

// OpenAI example
const response = await openai.chat.completions.create({...});
const tokens = extractOpenAITokens(response);
await logAPICall('inventor', 'Generated description', tokens, 'gpt-4');

// Claude example
const response = await anthropic.messages.create({...});
const tokens = extractClaudeTokens(response);
await logAPICall('writer', 'Drafted copy', tokens, 'claude-3-sonnet');
```

---

## Agent IDs

Use your agent ID when logging:

| Agent | ID | Emoji |
|-------|-----|-------|
| Architect | architect | 💻 |
| Inventor | inventor | 💡 |
| Analyst | analyst | 🔬 |
| Scout | scout | 📡 |
| Writer | writer | ✍️ |
| Editor | reviewer | 🔍 |
| Strategist | strategist | 🎯 |
| Researcher | researcher | 📚 |
| KimiClaw | kimiclaw | 🦞 |

---

## Categories

| Category | Use For |
|----------|---------|
| task | Starting/completing work |
| api_call | External API requests |
| file_upload | Uploading files |
| decision | Making choices |
| error | Failures/issues |
| notification | Alerts/messages |
| workflow | Multi-step processes |

---

## Best Practices

1. **Log task starts** — When you begin work
2. **Log task ends** — When you finish (with duration if possible)
3. **Log API calls** — Always include tokens and cost
4. **Log errors** — So we can track failure rates
5. **Be descriptive** — "Fixed login bug" not "Did work"

---

## Viewing Activity

Open Mission Control → Agents tab to see:
- Recent activity feed
- Agent performance metrics
- Token usage and costs
- Success rates

---

## Example Workflow

```bash
# 1. Start task
node scripts/log-activity.mjs inventor task_start "Designing Keychain Can Carrier"

# 2. Make API call
node scripts/api-logger.mjs inventor "Generated 3 design variations" 3200 gpt-4

# 3. Upload file
node scripts/log-activity.mjs inventor file_upload "Uploaded STL file" file_upload '{"filename":"keychain_v1.stl"}'

# 4. Complete task
node scripts/log-activity.mjs inventor task_complete "Keychain design complete" task '{"duration":1800000}'
```

---

## Troubleshooting

**Script not found?**
- Make sure you're in the Mission-Control-V6 directory
- Use: `cd ~/Mission-Control-V6` (or your path)

**Permission denied?**
- Make scripts executable: `chmod +x scripts/*.mjs`

**Logs not showing in MC?**
- Hard refresh the page (Ctrl+Shift+R)
- Check that your agent ID matches exactly

---

*Questions? Ask the Architect in #💻-architect*
