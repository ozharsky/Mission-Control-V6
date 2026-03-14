#!/usr/bin/env node
/**
 * Discord Notification Sender - Cron Job
 * Mission Control V6
 * 
 * Checks Firebase for pending Discord notifications and processes them
 * Run with: node scripts/discord-notification-sender.js
 * 
 * This script:
 * 1. Checks v6/discordNotifications for pending notifications
 * 2. Sends the message to the specified Discord channel
 * 3. Triggers the assigned agent to start working on the task
 * 4. Updates notification status to 'sent' in Firebase
 * 5. Logs success/failure
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update, remove, set } from 'firebase/database';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://mission-control-sync-default-rtdb.firebaseio.com',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

// Discord bot token
const DISCORD_TOKEN = process.env.DISCORD_DEFAULT_TOKEN || '';

// Agent channel mapping
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

async function main() {
  console.log('🔍 Checking for pending Discord notifications...');
  console.log(`⏰ ${new Date().toISOString()}`);
  
  try {
    const notificationsRef = ref(db, 'v6/discordNotifications');
    const snapshot = await get(notificationsRef);
    
    if (!snapshot.exists()) {
      console.log('✅ No notifications found in queue');
      return;
    }
    
    const notifications = snapshot.val();
    const pendingNotifications = Object.entries(notifications)
      .filter(([_, n]) => n.status === 'pending')
      .map(([id, n]) => ({ ...n, id }));
    
    if (pendingNotifications.length === 0) {
      console.log('✅ No pending notifications');
      return;
    }
    
    console.log(`📨 Found ${pendingNotifications.length} pending notification(s)`);
    
    for (const notification of pendingNotifications) {
      await processNotification(notification);
    }
    
    console.log(`\n✅ Completed processing ${pendingNotifications.length} notification(s)`);
    
  } catch (error) {
    console.error('❌ Error checking notifications:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

async function processNotification(notification) {
  console.log(`\n📤 Processing: ${notification.id}`);
  console.log(`   Channel: ${notification.channelId}`);
  console.log(`   Message: ${notification.message.substring(0, 60)}...`);
  
  try {
    // 1. Send Discord message
    const discordSuccess = await sendDiscordMessage(notification.channelId, notification.message);
    
    if (!discordSuccess) {
      throw new Error('Failed to send Discord message');
    }
    
    console.log('   ✅ Discord message sent');
    
    // 2. Trigger agent if this is a task notification
    let agentTriggered = false;
    if (notification.referenceId && notification.referenceId.startsWith('task-')) {
      agentTriggered = await triggerAgent(notification);
      if (agentTriggered) {
        console.log('   ✅ Agent triggered');
      }
    }
    
    // 3. Update status to sent
    await update(ref(db, `v6/discordNotifications/${notification.id}`), {
      status: 'sent',
      sentAt: Date.now(),
      agentTriggered: agentTriggered
    });
    
    console.log(`   ✅ Notification marked as sent`);
    
    // 4. Clean up after 1 hour (schedule removal)
    setTimeout(async () => {
      try {
        await remove(ref(db, `v6/discordNotifications/${notification.id}`));
      } catch (e) {
        // Silent cleanup failure is OK
      }
    }, 3600000);
    
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    
    await update(ref(db, `v6/discordNotifications/${notification.id}`), {
      status: 'failed',
      error: error.message,
      failedAt: Date.now()
    });
  }
}

async function sendDiscordMessage(channelId, message) {
  try {
    // Use Discord API directly
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: message })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('   Discord API error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   Discord send error:', error.message);
    return false;
  }
}

async function triggerAgent(notification) {
  try {
    // Extract agent from message content
    const agentMatch = notification.message.match(/@(\w+)/);
    if (!agentMatch) return false;
    
    const agentMention = agentMatch[1].toLowerCase();
    const agentId = MENTION_TO_AGENT[agentMention];
    
    if (!agentId) {
      console.log(`   ⚠️ Unknown agent mention: @${agentMention}`);
      return false;
    }
    
    // Get task details - try both task- and workflow- prefixes
    let taskSnapshot = null;
    let taskPath = null;
    
    if (notification.referenceId) {
      // Try tasks first
      taskSnapshot = await get(ref(db, `v6/tasks/${notification.referenceId}`));
      taskPath = `v6/tasks/${notification.referenceId}`;
      
      // If not found, try workflows
      if (!taskSnapshot.exists()) {
        taskSnapshot = await get(ref(db, `v6/workflows/${notification.referenceId}`));
        taskPath = `v6/workflows/${notification.referenceId}`;
      }
    }
    
    const task = taskSnapshot?.exists() ? taskSnapshot.val() : null;
    const channelId = AGENT_CHANNELS[agentId];
    
    if (!channelId) {
      console.log(`   ⚠️ No channel for agent: ${agentId}`);
      return false;
    }
    
    // Build agent prompt
    const prompt = buildAgentPrompt(task, agentId, notification);
    
    // Send message to agent's Discord channel session using OpenClaw sessions_send
    const sessionKey = await findAgentSession(agentId, channelId);
    
    if (sessionKey) {
      // Send directly to the agent session
      await sendToAgentSession(sessionKey, prompt);
      console.log(`   🚀 Triggered ${agentId} agent via sessions_send (session: ${sessionKey})`);
    } else {
      // Fallback: Create Firebase trigger for agent to pick up later
      await createAgentTrigger(agentId, notification, prompt);
      console.log(`   ⚠️ No active session for ${agentId}, created Firebase trigger`);
    }
    
    return true;
    
  } catch (error) {
    console.error('   Error triggering agent:', error);
    return false;
  }
}

async function findAgentSession(agentId, channelId) {
  // Sessions need to be queried via the sessions_list tool
  // For now, we'll use Firebase triggers as the primary mechanism
  // since we can't directly query sessions from this script
  return null;
}

async function sendToAgentSession(sessionKey, prompt) {
  // This function is no longer used - we rely on Firebase triggers instead
  // since we cannot call sessions_send from this script context
  return false;
}

async function createAgentTrigger(agentId, notification, prompt) {
  // Create a minimal trigger even without task details or if session send failed
  const triggerId = `trigger-${Date.now()}`;
  await set(ref(db, `v6/agentTriggers/${triggerId}`), {
    agentId: agentId,
    taskId: notification.referenceId,
    channelId: AGENT_CHANNELS[agentId],
    prompt: prompt || `You have been assigned a new task.

**Notification:** ${notification.message}
**Reference:** ${notification.referenceId}

Please review and begin work on this task.`,
    status: 'pending',
    createdAt: Date.now(),
    notificationId: notification.id
  });
}

function buildAgentPrompt(task, agentId, notification) {
  const taskId = task.id || notification?.referenceId || 'unknown';
  const taskTitle = task.title || 'Untitled Task';
  const taskPriority = task.priority || 'medium';
  const taskStatus = task.status || 'pending';
  
  const basePrompt = `You have been assigned a new task in Mission Control V6.

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Priority:** ${taskPriority}
**Status:** ${taskStatus}`;

  const agentPrompts = {
    surveyor: `${basePrompt}

Your role as the Researcher/Surveyor is to gather comprehensive information on the given topic.

**Instructions:**
1. Research the topic thoroughly using available tools
2. Search for relevant information, data, and context
3. Compile findings into a structured report
4. Focus on facts, statistics, and credible sources
5. Return your findings in a clear, organized format

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please begin your research and provide comprehensive findings.`,

    planner: `${basePrompt}

Your role as the Strategist/Planner is to create a detailed action plan based on the research findings.

**Instructions:**
1. Review any available research data
2. Create a structured plan with clear phases/steps
3. Identify dependencies and sequencing
4. Set measurable milestones
5. Consider resources and constraints

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please create a comprehensive strategic plan.`,

    ideator: `${basePrompt}

Your role as the Inventor/Ideator is to generate creative ideas and solutions.

**Instructions:**
1. Brainstorm multiple approaches and concepts
2. Think outside the box - consider unconventional solutions
3. Develop each idea with key benefits and considerations
4. Prioritize ideas by impact and feasibility
5. Present 3-5 strong concepts with rationale

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please generate creative ideas for this task.`,

    coder: `${basePrompt}

Your role as the Architect/Coder is to implement technical solutions.

**Instructions:**
1. Analyze the requirements carefully
2. Design an appropriate technical solution
3. Write clean, well-documented code
4. Test your implementation
5. Provide usage examples

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please implement the technical solution.`,

    writer: `${basePrompt}

Your role as the Wordsmith/Writer is to create compelling written content.

**Instructions:**
1. Craft clear, engaging copy
2. Adapt tone and style to the audience
3. Structure content for readability
4. Edit for clarity and impact
5. Deliver polished, publication-ready text

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please create the requested written content.`,

    reviewer: `${basePrompt}

Your role as the Editor/Reviewer is to quality-check and refine work.

**Instructions:**
1. Review the submitted work thoroughly
2. Check for accuracy, clarity, and completeness
3. Identify issues or areas for improvement
4. Provide constructive feedback
5. Suggest specific edits or revisions

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please review and provide feedback.`,

    critic: `${basePrompt}

Your role as the Analyst/Critic is to evaluate and provide critical assessment.

**Instructions:**
1. Analyze the work objectively
2. Identify strengths and weaknesses
3. Evaluate against criteria and goals
4. Provide balanced, constructive criticism
5. Suggest improvements or alternatives

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please provide your critical analysis.`,

    scout: `${basePrompt}

Your role as the Scout is to monitor trends and gather market intelligence.

**Instructions:**
1. Research current trends related to the topic
2. Monitor competitor activities if applicable
3. Identify opportunities and threats
4. Gather relevant market data
5. Provide actionable intelligence

**Task Input:** ${JSON.stringify(task.input || task.data || {})}

Please gather and report on relevant trends and intelligence.`
  };

  return agentPrompts[agentId] || basePrompt;
}

// Run the script
main();
