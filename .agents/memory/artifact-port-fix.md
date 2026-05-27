---
name: Artifact port registration fix
description: Why artifact workflows fail with DIDNT_OPEN_A_PORT and how to fix it
---

## The Rule
Any port used by an artifact's dev service must be registered in `.replit` under `[[ports]]`. Without this entry, the workflow runner's port detection always fails with `DIDNT_OPEN_A_PORT` even when the server is genuinely listening.

**Why:** Replit's workflow runner only checks ports that are registered in `.replit`. Unregistered ports are invisible to it regardless of whether the TCP socket is open.

**How to apply:** When an artifact workflow consistently fails with `DIDNT_OPEN_A_PORT` and manual tests confirm the server IS running on the expected port, check `.replit` for a `[[ports]]` entry matching that `localPort`. If missing, add it via `verifyAndReplaceDotReplit` with a temp file containing the full updated `.replit` content.

## What Happened
The `cleaning-schedule` artifact was created (non-UUID id: `artifacts/cleaning-schedule`) with `localPort = 3001`. The `createArtifact` call never added port 3001 to `.replit`'s `[[ports]]` section. Other artifacts (api-server port 8080, mockup-sandbox port 8081) had their ports properly registered and worked fine.

Changing the port to 8082 and adding `[[ports]] localPort = 8082 / externalPort = 8082` via `verifyAndReplaceDotReplit` resolved the issue immediately.

## Diagnosis Checklist
1. Server IS up (logs show "ready", curl returns 200)
2. Port IS in `/proc/net/tcp` (correct binding)
3. Workflow runner STILL says `DIDNT_OPEN_A_PORT`
→ Check `.replit` for the `[[ports]]` entry — it's almost certainly missing.

## Fix
```javascript
// Write full .replit to a temp path, then:
await verifyAndReplaceDotReplit({
    tempFilePath: "/home/runner/workspace/.replit-edit",
    dotReplitPath: "/home/runner/workspace/.replit"
});
```
