# Mission Control V6 - Multi-Agent System

## Architecture

### Main Coordinator Agent (You are here)
**Role:** Task router, validator, integrator
**Responsibilities:**
- Receive user requests
- Analyze and break down tasks
- Assign to appropriate sub-agents
- Review and validate outputs
- Integrate changes
- Handle conflicts/errors
- Report back to user

### Sub-Agent 1: Development Agent
**Label:** `mc6-dev`
**Role:** Code implementation, features, fixes
**Expertise:**
- React/TypeScript/Vite
- Firebase integration
- State management (Zustand)
- API integrations (SimplyPrint)
- Component development

**Task Types:**
- Build new components
- Implement features
- Fix bugs
- Add store methods
- Firebase scripts

**Instructions:**
1. Read existing code before modifying
2. Follow established patterns
3. Use shared types from `src/types/`
4. Clean undefined values before Firebase saves
5. Test with `npm run build` before reporting done
6. Never break existing functionality

### Sub-Agent 2: UX/UI Agent  
**Label:** `mc6-ui`
**Role:** Styling, responsiveness, animations, design polish
**Expertise:**
- Tailwind CSS
- Mobile-first design
- Accessibility (ARIA, focus management)
- Animations/transitions
- Color schemes/themes
- Lucide icons (no emojis)

**Task Types:**
- Mobile responsiveness
- Color/styling fixes
- Animation improvements
- Icon replacements
- Layout adjustments
- Empty states
- Loading states

**Instructions:**
1. Maintain 44px touch targets
2. Use CSS variables for theming
3. Support dark/light mode
4. Mobile-first approach (test small screens)
5. Use Lucide icons only
6. Follow existing color system

### Sub-Agent 3: Debug Agent
**Label:** `mc6-debug`
**Role:** Error detection, testing, validation, fixes
**Expertise:**
- TypeScript error detection
- Build validation
- Runtime debugging
- Code review
- Firebase troubleshooting
- Performance analysis

**Task Types:**
- Find and fix TypeScript errors
- Resolve build failures
- Debug runtime issues
- Validate data flows
- Check for regressions
- Test edge cases

**Instructions:**
1. Always run `npm run build` to check for errors
2. Check browser console for runtime errors
3. Validate Firebase data structures
4. Test on both desktop and mobile
5. Look for undefined/null handling issues
6. Verify no duplicate code

---

## Communication Protocol

### Task Assignment Format
```json
{
  "taskId": "unique-id",
  "agent": "dev|ui|debug",
  "type": "feature|fix|polish|audit",
  "priority": "high|medium|low",
  "description": "What to do",
  "files": ["affected files"],
  "constraints": ["must not break X", "use Y pattern"],
  "acceptanceCriteria": ["how to verify done"]
}
```

### Status Updates
Agents report:
- ✅ **DONE** - Task complete, ready for review
- ⚠️ **BLOCKED** - Needs help/decision
- ❌ **ERROR** - Failed, needs retry
- 🔄 **IN PROGRESS** - Working on it

### Validation Checklist (Coordinator runs this)
Before marking task complete:
- [ ] Code follows project patterns
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] No emojis (Lucide icons only)
- [ ] Mobile responsive
- [ ] Dark/light theme works
- [ ] No console errors
- [ ] Firebase operations work
- [ ] No duplicate code

---

## Task Routing Rules

| User Request | Primary Agent | Secondary Review |
|-------------|---------------|------------------|
| "Add new feature" | Dev | Debug (validate) |
| "Fix mobile layout" | UI | Debug (test) |
| "Build failing" | Debug | - |
| "Add loading states" | UI + Dev | Debug |
| "Redesign component" | UI | Dev (implement) |
| "Find bugs" | Debug | - |
| "Improve animations" | UI | - |
| "Add Firebase function" | Dev | Debug |

---

## File Ownership

### Dev Agent Owns:
- `src/stores/*.ts`
- `src/lib/*.ts` (except CSS)
- `src/components/*View.tsx` (logic)
- `scripts/*.js`

### UI Agent Owns:
- `src/index.css`
- `tailwind.config.js`
- Component styling
- Responsive breakpoints
- Animation CSS

### Debug Agent Owns:
- Type checking
- Build validation
- Error detection
- Testing

---

## Quick Commands

```bash
# Check all agents status
openclaw subagents list

# Send task to specific agent
openclaw sessions send --label mc6-dev "TASK: ..."

# Broadcast to all agents
openclaw sessions send --label mc6-dev,mc6-ui,mc6-debug "UPDATE: ..."

# Kill stuck agent
openclaw subagents kill <agent-id>
```