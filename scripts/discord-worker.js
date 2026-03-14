#!/usr/bin/env node
/**
 * Discord Notification Worker
 * Mission Control V6
 * 
 * Watches Firebase for pending Discord notifications and sends them
 * Also triggers assigned agents to start working on tasks
 * Run with: node scripts/discord-worker.js
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onChildAdded, update, remove, get, set } from 'firebase/database';

// Firebase config - same as V6
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://mission-control-sync-default-rtdb.firebaseio.com',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

// Discord bot tokens from OpenClaw config
const DISCORD_TOKENS = {
  default: process.env.DISCORD_DEFAULT_TOKEN || ''
};

// Agent channel mapping for triggering agents
const AGENT_CHANNELS = {
  surveyor: '1478488543692194045',    // #📚-researcher
  planner: '1478488078870909088',      // #🎯-strategist
  ideator: '1478488081186291928',      // #💡-inventor
  critic: '1478488084386418689',       // #🔬-analyst
  scout: '1478488086672441536',        // #📡-scout
  coder: '1478488318927700091',        // #💻-architect
  writer: '1478488320454557727',       // #✍️-wordsmith
  reviewer: '1478488321914310758'      // #🔍-editor
};

// Map Discord mentions to agent IDs
const MENTION_TO_AGENT = {
  'researcher': 'surveyor',
  'strategist': 'planner',
  'inventor': 'ideator',
  'analyst': 'critic',
  'scout': 'scout',
  'architect': 'coder',
  'wordsmith': 'writer',
  'editor': 'reviewer'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log('🤖 Discord Notification Worker started');
console.log('📡 Watching v6/discordNotifications...');

// Watch for new notifications
const notificationsRef = ref(db, 'v6/discordNotifications');

onChildAdded(notificationsRef, async (snapshot) => {
  const notification = snapshot.val();
  
  if (notification.status !== 'pending') return;
  
  console.log(`📨 Processing notification to ${notification.channelId}:`, notification.message.substring(0, 50) + '...');
  
  try {
    // 1. Send to Discord via bot API
    const success = await sendDiscordMessage(notification.channelId, notification.message);
    
    if (!success) {
      throw new Error('Discord API returned error');
    }
    
    // 2. Trigger the assigned agent if this is a task notification
    const agentTriggered = await triggerAgentIfNeeded(notification);
    
    // 3. Mark as sent
    await update(ref(db, `v6/discordNotifications/${notification.id}`), {
      status: 'sent',
      sentAt: Date.now(),
      agentTriggered: agentTriggered
    });
    console.log(`✅ Sent: ${notification.id}${agentTriggered ? ' (agent triggered)' : ''}`);
    
    // Clean up after 1 hour
    setTimeout(() => {
      remove(ref(db, `v6/discordNotifications/${notification.id}`));
    }, 3600000);
    
  } catch (error) {
    console.error(`❌ Failed to send ${notification.id}:`, error);
    await update(ref(db, `v6/discordNotifications/${notification.id}`), {
      status: 'failed',
      error: error.message,
      failedAt: Date.now()
    });
  }
});

async function sendDiscordMessage(channelId, message) {
  try {
    // Use Discord bot API
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_TOKENS.default}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: message })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Discord API error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Discord send error:', error);
    return false;
  }
}

// Keep alive
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

/**
 * Trigger agent via OpenClaw sessions_send if this is a task notification
 */
async function triggerAgentIfNeeded(notification) {
  try {
    // Check if this is a task notification by looking for task reference
    if (!notification.referenceId || !notification.referenceId.startsWith('task-')) {
      return false;
    }
    
    // Extract agent from message content (look for agent mention patterns)
    const agentMatch = notification.message.match(/@(\w+)/);
    if (!agentMatch) return false;
    
    const agentMention = agentMatch[1].toLowerCase();
    const agentId = MENTION_TO_AGENT[agentMention];
    
    if (!agentId) {
      console.log(`⚠️ Unknown agent mention: @${agentMention}`);
      return false;
    }
    
    // Get the task details from Firebase
    const taskSnapshot = await get(ref(db, `v6/tasks/${notification.referenceId}`));
    if (!taskSnapshot.exists()) return false;
    
    const task = taskSnapshot.val();
    const channelId = AGENT_CHANNELS[agentId];
    
    if (!channelId) {
      console.log(`⚠️ No channel configured for agent: ${agentId}`);
      return false;
    }
    
    // Build task prompt for the agent
    const taskPrompt = buildAgentPrompt(task, agentId);
    
    // Create an agent trigger record
    console.log(`🚀 Triggering ${agentId} agent for task: ${task.id}`);
    
    await set(ref(db, `v6/agentTriggers/${task.id}`), {
      agentId: agentId,
      taskId: task.id,
      channelId: channelId,
      prompt: taskPrompt,
      status: 'pending',
      createdAt: Date.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error triggering agent:', error);
    return false;
  }
}

/**
 * Build appropriate prompt for each agent type
 */
function buildAgentPrompt(task, agentId) {
  const basePrompt = `You have been assigned a new task in Mission Control V6.

**Task ID:** ${task.id}
**Title:** ${task.title}
**Priority:** ${task.priority}
**Status:** ${task.status}`;

  const agentPrompts = {
    surveyor: `${basePrompt}

Your role as the Researcher/Surveyor is to gather comprehensive information on the given topic.

**Instructions:**
1. Research the topic thoroughly using available tools
2. Search for relevant information, data, and context
3. Compile findings into a structured report
4. Focus on facts, statistics, and credible sources
5. Return your findings in a clear, organized format

**Task Input:** ${JSON.stringify(task.input || {})}

Please begin your research and provide comprehensive findings.`,

    planner: `${basePrompt}

Your role as the Strategist/Planner is to create a detailed action plan based on the research findings.

**Instructions:**
1. Review any available research data
2. Create a structured plan with clear phases/steps
3. Identify dependencies and sequencing
4. Set measurable milestones
5. Consider resources and constraints

**Task Input:** ${JSON.stringify(task.input || {})}

Please create a comprehensive strategic plan.`,

    ideator: `${basePrompt}

Your role as the Inventor/Ideator is to generate creative ideas and solutions.

**Instructions:**
1. Brainstorm multiple approaches and concepts
2. Think outside the box - consider unconventional solutions
3. Develop each idea with key benefits and considerations
4. Prioritize ideas by impact and feasibility
5. Present 3-5 strong concepts with rationale

**Task Input:** ${JSON.stringify(task.input || {})}

Please generate creative ideas for this task.`,

    coder: `${basePrompt}

Your role as the Architect/Coder is to implement technical solutions.

**Instructions:**
1. Analyze the requirements carefully
2. Design an appropriate technical solution
3. Write clean, well-documented code
4. Test your implementation
5. Provide usage examples

**Task Input:** ${JSON.stringify(task.input || {})}

Please implement the technical solution.`,

    writer: `${basePrompt}

Your role as the Wordsmith/Writer is to create compelling written content.

**Instructions:**
1. Craft clear, engaging copy
2. Adapt tone and style to the audience
3. Structure content for readability
4. Edit for clarity and impact
5. Deliver polished, publication-ready text

**Task Input:** ${JSON.stringify(task.input || {})}

Please create the requested written content.`,

    reviewer: `${basePrompt}

Your role as the Editor/Reviewer is to quality-check and refine work.

**Instructions:**
1. Review the submitted work thoroughly
2. Check for accuracy, clarity, and completeness
3. Identify issues or areas for improvement
4. Provide constructive feedback
5. Suggest specific edits or revisions

**Task Input:** ${JSON.stringify(task.input || {})}

Please review and provide feedback.`,

    critic: `${basePrompt}

Your role as the Analyst/Critic is to evaluate and provide critical assessment.

**Instructions:**
1. Analyze the work objectively
2. Identify strengths and weaknesses
3. Evaluate against criteria and goals
4. Provide balanced, constructive criticism
5. Suggest improvements or alternatives

**Task Input:** ${JSON.stringify(task.input || {})}

Please provide your critical analysis.`,

    scout: `${basePrompt}

Your role as the Scout is to monitor trends and gather market intelligence.

**Instructions:**
1. Research current trends related to the topic
2. Monitor competitor activities if applicable
3. Identify opportunities and threats
4. Gather relevant market data
5. Provide actionable intelligence

**Task Input:** ${JSON.stringify(task.input || {})}

Please gather and report on relevant trends and intelligence.`
  };

  return agentPrompts[agentId] || basePrompt;
}
