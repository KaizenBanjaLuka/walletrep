---
description: Save a timestamped session summary to session_log.md
tools: Write, Read, Bash
---

Do the following right now:

1. Get the current date and time by running: `date "+%Y-%m-%d %H:%M:%S"`
2. Read the existing `session_log.md` in the project root (if it exists), then write the full file back with a new entry appended at the bottom in this format:

---
## [DATE AND TIME FROM STEP 1]
**What was built:** [summarize what we completed]
**Decisions made:** [list any architectural or logic decisions]
**Problems solved:** [any bugs or blockers we fixed]
**Next step:** [what to do in the next session]
---

3. Confirm to me that the log was saved.
