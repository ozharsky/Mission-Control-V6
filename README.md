# Mission Control V6

A modern, real-time dashboard for managing OZ3DPrint operations with AI agent integration.

## Features

- 🤖 **Agent Integration** - Real-time communication with AI agent
- 🖨️ **Printer Monitoring** - Live status, temperatures, progress
- 💰 **Revenue Tracking** - Charts, trends, goals
- 📋 **Priorities & Tasks** - Kanban board, task management
- 💬 **Agent Chat** - Direct messaging
- 🔔 **Notifications** - Real-time alerts
- 📱 **Mobile First** - Responsive design, mobile app-like UI

## Tech Stack

- React + TypeScript + Vite
- Firebase Realtime Database
- Zustand State Management
- Tailwind CSS
- Recharts

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Data Migration

To migrate data from V5 to V6:

```bash
node scripts/migrate-v5-to-v6.js
```

## Deployment

1. Push to GitHub
2. Enable GitHub Pages in repo settings (GitHub Actions source)
3. Workflow auto-deploys on push

## Firebase Structure

```
mission-control-sync-default-rtdb.firebaseio.com/
├── data/              # V5 data (preserved)
└── v6/                # V6 data
    ├── agent/         # Agent status
    ├── tasks/         # Task management
    ├── notifications/ # Alerts
    ├── chat/          # Messages
    └── data/          # Migrated V5 data
```

## License

MIT
# Deploy trigger Wed Mar  4 02:54:08 AM CST 2026
# Build trigger Fri Mar  6 01:37:02 AM CST 2026
