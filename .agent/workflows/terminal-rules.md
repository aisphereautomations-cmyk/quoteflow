---
description: PowerShell terminal rules - do not use && to chain commands
---

# PowerShell Terminal Rules

## ⚠️ Do NOT use `&&` to chain commands

This project runs on **Windows with PowerShell**. PowerShell does **NOT** support `&&` for chaining commands (that's a bash/cmd thing in newer versions).

### ❌ Wrong
```powershell
git add -A && git commit -m "message"
```
This will hang/fail silently.

### ✅ Correct
Run commands **separately**, one at a time:
```powershell
git add -A
```
Then:
```powershell
git commit -m "message"
```
Then:
```powershell
git push
```

## Other Notes
- Always use separate `run_command` calls for each command
- Use `;` if you absolutely must chain in one line (but separate calls are preferred)
