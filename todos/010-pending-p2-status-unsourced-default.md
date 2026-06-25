---
status: pending
priority: p2
issue_id: 010
tags: [code-review, data-integrity]
dependencies: []
---
# status defaults EN_EJERCICIO for all 57 with no source backing the "sitting" claim

## Problem Statement
`status = ov?.status ?? "EN_EJERCICIO"` with an empty overrides file. Being EN_EJERCICIO is what makes a person scored AND ranked, but it's an unsourced assumption — a member on licencia would be scored/ranked unfairly. (Correctly, status is never inferred from absences.)

## Fix
- Source sitting status from the profile/Directorio; until then treat the all-EN_EJERCICIO assumption as a manual verification gate before publishing names, and document it.

## Acceptance Criteria
- [ ] Each scored diputado's sitting status is source-backed or manually verified pre-publish.
