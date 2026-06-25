---
status: pending
priority: p2
issue_id: 011
tags: [code-review, honesty, copy]
dependencies: []
---
# Methodology says "1 a 10" but the real scale floor is 0

## Problem Statement
`pctToScore` clamps to [0,10]; a real diputado has participación 0.3 and min overall 1.1. The methodology's "una nota de 1 a 10 … 92% = 9.2" misdescribes its own scale on the credibility page.

## Fix
- Say "0 a 10" (or formally floor scores at 1 if intended).

## Acceptance Criteria
- [ ] Methodology scale matches `pctToScore`.
