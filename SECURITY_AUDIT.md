# Mission Control V6 Security Audit

## Date: 2026-03-07
## Auditor: The Architect

---

## 🔴 CRITICAL Issues Found

### 1. Hardcoded API Key in Scripts
**Files:**
- `scripts/log-activity.mjs` - Line 9: `const API_KEY = 'Nxc4fUHTmPEzB2mAz7yfjYY2uwPR72n2pGyrX2qH'`
- `scripts/parseAgentLog.mjs` - Line 8: Hardcoded fallback API key

**Risk:** Anyone can see this key in the public repo and use it to log fake activity.

**Fix:** Move to environment variables immediately.

---

## 🟡 MEDIUM Issues Found

### 2. API Endpoint CORS is Wide Open
**File:** `api/log-activity.mjs`
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Risk:** Any website can call your API.

**Fix:** Restrict to your domains only.

### 3. No Rate Limiting on API
**File:** `api/log-activity.mjs`

**Risk:** Could be spammed with requests.

**Fix:** Add rate limiting (e.g., 100 req/min per IP).

### 4. Firebase Rules Not in Repo
**Status:** No `database.rules.json` or `firestore.rules` in repo.

**Risk:** Can't audit security rules. Rules might be too permissive.

**Fix:** Add rules file to repo (without secrets).

### 5. Git History May Contain Secrets
**Risk:** Old commits might have API keys that were later removed.

**Fix:** Scan git history with `git log -p | grep -i "api_key\|secret"`

---

## 🟢 GOOD Security Practices

✅ API keys stored in `localStorage` (client-side only)  
✅ API endpoint validates `Authorization` header  
✅ No passwords in code  
✅ No `.env` files in repo  
✅ Firebase Admin uses environment variables  
✅ API key input uses `type="password"`  

---

## 📋 Immediate Action Items

### Priority 1 (Do Today)
1. **Rotate the exposed API key**
   ```bash
   # Generate new key
   openssl rand -base64 32
   ```
   
2. **Update Vercel environment variable**
   - Go to Vercel dashboard → Project → Settings → Environment Variables
   - Update `AGENT_API_KEY` with new key
   - Redeploy

3. **Fix scripts to use env vars**
   - Remove hardcoded keys
   - Use `process.env.AGENT_API_KEY`

### Priority 2 (This Week)
4. **Restrict CORS**
   ```javascript
   // Instead of '*'
   const allowedOrigins = [
     'https://ozharsky.github.io',
     'https://mission-control-v6-kappa.vercel.app'
   ];
   ```

5. **Add rate limiting**
   ```javascript
   // Simple in-memory rate limit
   const requests = new Map();
   // Check IP, allow 100 req/min
   ```

6. **Add Firebase rules file to repo**
   ```json
   {
     "rules": {
       "v6": {
         ".read": "auth != null",
         ".write": "auth != null"
       }
     }
   }
   ```

### Priority 3 (This Month)
7. **Enable Firebase App Check**
   - Prevents abuse from non-app sources
   
8. **Add request logging**
   - Log IP, timestamp, agent ID
   - Helps detect abuse

9. **Scan git history**
   ```bash
   git log --all --full-history -- '*.mjs' '*.ts' | grep -i "key\|secret\|token"
   ```

---

## 🔐 Recommended Firebase Rules

```json
{
  "rules": {
    "v6": {
      // Public read for most data
      "tasks": {
        ".read": true,
        ".write": "auth != null"
      },
      "projects": {
        ".read": true,
        ".write": "auth != null"
      },
      "printers": {
        ".read": true,
        ".write": "auth != null"
      },
      // Agent activity - restricted
      "agentActivity": {
        ".read": true,
        ".write": false,  // Only via API
        "logs": {
          "$logId": {
            ".write": "auth != null || root.child('apiKeys').child(auth.token.apiKey).exists()"
          }
        }
      },
      // Files - authenticated only
      "files": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

---

## 🛡️ Security Checklist

- [ ] Rotate exposed API key
- [ ] Remove hardcoded keys from scripts
- [ ] Update Vercel env vars
- [ ] Restrict CORS origins
- [ ] Add rate limiting
- [ ] Add Firebase rules to repo
- [ ] Scan git history for secrets
- [ ] Enable Firebase App Check
- [ ] Add request logging
- [ ] Document security practices

---

## 📊 Current Security Score: 6/10

| Category | Score | Notes |
|----------|-------|-------|
| Secret Management | 4/10 | Hardcoded API key |
| API Security | 5/10 | Open CORS, no rate limit |
| Firebase Config | 7/10 | Uses env vars, but no rules file |
| Client Security | 8/10 | Keys in localStorage, password fields |
| Overall | 6/10 | Fix critical issues to get to 9/10 |

---

## 🚨 After Fixes: Expected Score 9/10

Remaining risk: GitHub Pages is public (by design), Firebase is public read for dashboard data (acceptable for this use case).
