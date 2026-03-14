# Agent File Upload Guide

## Quick Upload (from OpenClaw)

Use the `upload_file` tool to send files to Mission Control:

```json
{
  "tool": "upload_file",
  "params": {
    "file_path": "/path/to/file.pdf",
    "category": "reports",
    "projectId": "optional-project-id",
    "metadata": {
      "description": "Agent-generated report"
    }
  }
}
```

## Setup for External Agents

### 1. Environment Variables

```bash
export AGENT_API_KEY="your-secret-key"
export MC_UPLOAD_URL="https://mission-control-v6-kappa.vercel.app/api/upload"
```

### 2. Upload Script

```bash
# Upload a file
node scripts/agent-uploader.mjs ./my-file.pdf --category=documents --agentId=architect

# With project association
node scripts/agent-uploader.mjs ./design.stl --category=designs --projectId=project-123

# With metadata
node scripts/agent-uploader.mjs ./analysis.json --category=data --metadata='{"type":"analysis"}'
```

### 3. API Endpoint (Direct HTTP)

```bash
curl -X POST https://mission-control-v6-kappa.vercel.app/api/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -d '{
    "fileData": "base64-encoded-file-data",
    "fileName": "report.pdf",
    "contentType": "application/pdf",
    "category": "reports",
    "agentId": "architect",
    "metadata": {"description": "Daily report"}
  }'
```

## Categories

- `agents` — Default for agent uploads
- `reports` — Generated reports
- `designs` — 3D models, STL files
- `documents` — PDFs, docs
- `images` — Screenshots, photos
- `data` — JSON, CSV files

## File Visibility

Files uploaded via this API will appear in:
1. Mission Control Files section
2. Associated project (if projectId specified)
3. Firebase Storage at `files/{category}/{filename}`

## Security

- API key required for all uploads
- Files are scanned by Firebase Security Rules
- Download URLs are signed and time-limited
