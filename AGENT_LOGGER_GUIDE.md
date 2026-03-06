# Agent Activity Logger - Quick Start

## For Agents in OpenClaw Sessions

The activity logger is already available in Mission Control V6. Here's how to use it:

### Basic Usage

```typescript
import { initActivityLogger } from './services/agentActivityLogger';
import { db } from './lib/firebase';

// Get logger instance
const logger = initActivityLogger(db);

// Log your work
await logger.logTaskStart('architect', 'task-123', 'Building feature X');

// Do your work...

await logger.logTaskComplete('architect', 'task-123', 'Feature X built', 3600000, {
  tokensUsed: 1500,
  costEstimate: 0.03
});
```

### Common Patterns

**Task Workflow:**
```typescript
const taskId = `task-${Date.now()}`;
const startTime = Date.now();

await logger.logTaskStart('your-agent-id', taskId, 'Description of work');

try {
  // Do work
  const result = await doWork();
  
  await logger.logTaskComplete('your-agent-id', taskId, 'Work completed', Date.now() - startTime, {
    success: true,
    result: result.summary
  });
} catch (error) {
  await logger.logTaskError('your-agent-id', taskId, error.message);
}
```

**API Calls (with cost tracking):**
```typescript
await logger.logAPICall('your-agent-id', 'OpenAI GPT-4', 2500, 0.075, {
  prompt: 'Generate report',
  model: 'gpt-4'
});
```

**File Uploads:**
```typescript
await logger.logFileUpload('your-agent-id', 'report.md', 'file-123', {
  category: 'reports',
  size: 1024
});
```

**Decisions:**
```typescript
await logger.logDecision('your-agent-id', 'Use React for UI', 'Better component ecosystem', {
  alternatives: ['Vue', 'Svelte'],
  impact: 'high'
});
```

### Environment Setup

Make sure these are set in your environment:
```bash
AGENT_ID=your-agent-id  # e.g., 'architect', 'inventor', 'analyst'
```

### View Your Activity

1. Open Mission Control V6
2. Go to **Agents** section
3. Click **Activity** tab
4. See real-time stats and logs

### What Gets Tracked

| Metric | Description |
|--------|-------------|
| Actions | Total number of logged actions |
| Success Rate | Percentage of successful tasks |
| Tokens Used | LLM/API token consumption |
| Cost Estimate | Estimated cost of API calls |
| Duration | Time spent on tasks |
| Categories | task, api_call, file_upload, decision, error |

### Best Practices

1. **Log at task start** — So duration is accurate
2. **Include metadata** — tokens, cost, success status
3. **Use descriptive descriptions** — Helps with filtering
4. **Log errors** — Track failure rates
5. **Log decisions** — Audit trail for choices made

### Example: Complete Workflow

```typescript
import { initActivityLogger } from './services/agentActivityLogger';
import { db } from './lib/firebase';

const logger = initActivityLogger(db);
const AGENT_ID = 'architect';

async function buildFeature(featureName: string) {
  const taskId = `build-${Date.now()}`;
  const startTime = Date.now();
  
  // Start logging
  await logger.logTaskStart(AGENT_ID, taskId, `Building ${featureName}`);
  
  try {
    // Design decision
    await logger.logDecision(AGENT_ID, 'Use TypeScript', 'Type safety for maintainability');
    
    // API call for code generation
    const tokens = 2500;
    const cost = 0.075;
    await logger.logAPICall(AGENT_ID, 'OpenAI', tokens, cost);
    
    // Build the feature
    const code = await generateCode(featureName);
    
    // Upload result
    await logger.logFileUpload(AGENT_ID, `${featureName}.ts`, `file-${Date.now()}`);
    
    // Complete
    await logger.logTaskComplete(AGENT_ID, taskId, `${featureName} built`, Date.now() - startTime, {
      tokensUsed: tokens,
      costEstimate: cost,
      success: true
    });
    
  } catch (error) {
    await logger.logTaskError(AGENT_ID, taskId, error.message);
    throw error;
  }
}
```

### Need Help?

Check the Activity tab in Mission Control to see your logs in real-time!
