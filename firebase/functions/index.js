const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { exec } = require('child_process');

admin.initializeApp();

// Trigger when a new notification is created
exports.onDiscordNotificationCreated = functions.database
  .ref('/v6/discordNotifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.val();
    const { notificationId } = context.params;
    
    // Only process pending notifications
    if (notification.status !== 'pending') {
      console.log(`Notification ${notificationId} is not pending, skipping`);
      return null;
    }
    
    const { channelId, message } = notification;
    
    console.log(`Processing notification ${notificationId} for channel ${channelId}`);
    
    try {
      // Mark as sending
      await snapshot.ref.update({ status: 'sending' });
      
      // Send Discord message using OpenClaw CLI
      const cmd = `openclaw message send --channel discord --target ${channelId} -m "${message.replace(/"/g, '\\"')}"`;
      
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error('Discord send error:', error);
            reject(error);
          } else {
            console.log('Discord message sent successfully');
            resolve(stdout);
          }
        });
      });
      
      // Mark as sent
      await snapshot.ref.update({ 
        status: 'sent',
        sentAt: Date.now()
      });
      
      console.log(`Notification ${notificationId} sent successfully`);
      return { success: true };
      
    } catch (error) {
      console.error(`Failed to send notification ${notificationId}:`, error);
      await snapshot.ref.update({ 
        status: 'failed',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
