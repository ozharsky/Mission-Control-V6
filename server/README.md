# Discord Webhook Server Setup

## Quick Start

1. **Install dependencies:**
```bash
cd Mission-Control-V6
npm install express cors
```

2. **Start the webhook server:**
```bash
node server/discord-webhook.js
```

The server will run on port 3001 (or set `DISCORD_WEBHOOK_PORT` env var).

3. **Test the server:**
```bash
curl http://localhost:3001/health
```

## Integration

The `DiscordNotificationService` now tries to send messages via this server first.
If the server is down, it falls back to queuing in Firebase.

## Endpoints

- `POST /send-discord` - Send single Discord message
- `POST /send-batch` - Send multiple messages
- `GET /health` - Health check

## Production

For production, deploy this as a separate service or use PM2:
```bash
npm install -g pm2
pm2 start server/discord-webhook.js --name discord-webhook
```
