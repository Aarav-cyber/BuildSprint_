# PR Review Triage Agent --- BuildSprint 2026

> **Goal:** Build a working AI-powered PR triage agent that watches
> GitHub pull requests, understands what changed, assesses risk,
> identifies the best reviewer(s), and sends an actionable triage card
> to Slack --- with stale-PR escalation.

This README turns the BuildSprint project plan into an implementation
roadmap. The source brief defines the core problem as PR queues that
treat trivial and high-risk changes equally, while the appropriate code
owner/reviewer is not automatically brought into the review.
fileciteturn0file0L4-L9

------------------------------------------------------------------------

## 1. Final Goal

By the end of the project, we should have **one complete, demonstrable
pipeline**:

``` text
Developer opens / updates PR
        │
        ▼
GitHub Webhook
        │
        ▼
Webhook Receiver
(Node.js + Express OR Python + FastAPI)
        │
        ▼
Fetch PR metadata + full diff
(GitHub REST/GraphQL API)
        │
        ▼
AI PR Analysis
(Groq API)
        │
        ├── Plain-English intent summary
        ├── Risk classification / score
        └── Suggested reviewer(s)
        │
        ▼
Slack Notification
        │
        ▼
Stale PR Checker
        │
        └── Escalates if review is overdue
```

The expected final experience is:

1.  A real PR is opened or updated in the demo repository.
2.  GitHub sends the event to our application.
3.  The application retrieves the PR description, metadata, changed
    files, and diff.
4.  The system produces a plain-English explanation of what the PR is
    trying to do.
5.  The system evaluates the PR's risk.
6.  The system determines who is best suited to review it using
    repository ownership and review history.
7.  A clean Slack card appears with the summary, risk, and reviewer
    recommendation.
8.  If the PR remains unreviewed, the stale-check process sends a
    follow-up/escalation.

The project brief specifically identifies the live GitHub → analysis →
Slack flow as the strongest demo signal because judges can understand
the before/after quickly. fileciteturn0file0L10-L20

------------------------------------------------------------------------

# 2. Problem We Are Solving

In a growing engineering team, pull requests can contain a mixture of:

-   Tiny typo/documentation changes
-   Normal feature work
-   Potentially dangerous changes
-   Authentication/security changes
-   Database migrations
-   Payment-related logic

A first-come-first-served review queue does not naturally prioritize
these by risk. A high-risk PR can therefore wait while trivial PRs are
reviewed first.

There is a second problem: the reviewer who is most familiar with the
affected code may not automatically be pulled into the review.

### Our solution

Instead of treating every PR equally, the agent answers three questions:

### **1. What is this PR doing?**

Generate a concise, plain-English intent summary.

Example:

> "Adds retry logic to the payment webhook handler."

instead of simply reporting:

> `+47 -12 lines in webhook.py`

### **2. How risky is it?**

Use signals such as:

-   Files/directories touched
-   Authentication-related changes
-   Migration-related changes
-   Payment-related changes
-   Diff size
-   Whether tests were added/changed
-   Presence of feature flags
-   LLM judgment

### **3. Who should review it?**

Use repository context such as:

-   `CODEOWNERS`
-   `git blame`
-   Recent review history
-   Who reviewed recent PRs touching the same files

The source plan explicitly calls for cross-referencing `git blame`,
`CODEOWNERS`, and recent review history to suggest the best-fit
reviewer(s). fileciteturn0file0L10-L18

------------------------------------------------------------------------

# 3. MVP Scope --- Keep This Strict

This is a **48-hour hackathon project**, so the MVP must remain focused.

## In scope

-   GitHub webhook
-   One demo repository
-   PR metadata retrieval
-   Full PR diff retrieval
-   AI-generated PR intent summary
-   Risk classification
-   Reviewer suggestion
-   Slack notification
-   Stale-PR reminder/escalation
-   Basic PR state/staleness tracking
-   Demo-ready formatting
-   Public repository
-   2-minute demo video

The source plan explicitly recommends keeping the MVP to **one pipeline,
one integration point, and one demo repository**.
fileciteturn0file0L21-L28

## Out of scope

Do **not** spend the 48-hour build window on:

-   Multi-repository support
-   Organization-wide support
-   ML training for reviewer selection
-   Historical outcome learning
-   A dashboard
-   A custom web UI beyond what is required for the backend/webhook
-   A complex authentication system
-   A full production database
-   Excessive integrations

These should be presented as **future work**, not MVP requirements.
fileciteturn0file0L29-L32

------------------------------------------------------------------------

# 4. Recommended Tech Stack

  Layer                  Recommended Technology
  ---------------------- -------------------------------------------
  Backend                Node.js + Express **or** Python + FastAPI
  AI                     Groq API
  Recommended model      `llama-3.3-70b-versatile`
  Fast fallback          `llama-3.1-8b-instant`
  GitHub                 GitHub REST/GraphQL API + Webhooks
  Node GitHub option     Probot
  Notifications          Slack Incoming Webhook
  Richer Slack option    Slack Bot API
  Hosting                Render / Railway / Fly.io
  Local webhook option   ngrok
  Storage                In-memory + JSON file, or SQLite

The project brief recommends Groq because it is OpenAI-compatible and
suitable for a fast live demo; it also recommends avoiding a full
database if a simpler state store is sufficient.
fileciteturn0file0L54-L70

------------------------------------------------------------------------

# 5. Prerequisites

Before implementation, make sure the team has:

## Required accounts/services

-   GitHub account
-   GitHub repository for the demo
-   Groq account/API access
-   Slack workspace/channel
-   Hosting account if deploying remotely
-   ngrok if running the webhook locally

## Required local software

-   Git
-   Node.js + npm **if using Node**
-   Python + pip/venv **if using FastAPI**
-   A code editor
-   A way to test HTTP/webhook requests

## Important hackathon rule

**LatentCode must be the only AI coding harness used to write project
code.**

Do not use:

-   Cursor for coding
-   GitHub Copilot for coding
-   Claude Code for coding
-   Other AI coding agents for the actual project codebase

AI tools may be used for:

-   Brainstorming
-   README drafting
-   Demo-script writing

The BuildSprint rulebook explicitly distinguishes these permitted uses
from AI-generated coding assistance. fileciteturn0file0L172-L177

------------------------------------------------------------------------

# 6. Project Structure

A clean structure should look approximately like this:

``` text
pr-review-triage-agent/
│
├── src/
│   ├── server/
│   │   ├── webhook
│   │   └── routes
│   │
│   ├── github/
│   │   ├── pr
│   │   ├── diff
│   │   ├── codeowners
│   │   └── review-history
│   │
│   ├── ai/
│   │   ├── groq-client
│   │   ├── prompts
│   │   └── triage
│   │
│   ├── risk/
│   │   └── scoring
│   │
│   ├── reviewer/
│   │   └── ranking
│   │
│   ├── slack/
│   │   └── notifier
│   │
│   └── stale/
│       └── checker
│
├── data/
│   └── state.json
│
├── tests/
│
├── .env.example
├── .gitignore
├── package.json / requirements.txt
└── README.md
```

The exact folder names are an implementation choice. What matters is
that the pipeline responsibilities remain separated.

------------------------------------------------------------------------

# 7. Environment Variables

Create a `.env` file locally.

Example:

``` env
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

GROQ_API_KEY=your_groq_api_key

SLACK_WEBHOOK_URL=your_slack_webhook_url

PORT=3000
```

## Security requirements

### Never commit secrets

`.gitignore` should include:

``` text
.env
node_modules/
__pycache__/
data/*.local.*
```

At minimum, the Groq API key must be stored as an environment variable
named:

``` text
GROQ_API_KEY
```

The project source specifically says to never commit the Groq key to the
repository. fileciteturn0file0L71-L79

------------------------------------------------------------------------

# 8. Step 1 --- Create the Demo Repository

Create one GitHub repository specifically for the demonstration.

The repository should contain realistic code that allows us to create
different PR types.

Ideally include areas such as:

``` text
src/
├── auth/
├── payments/
├── users/
├── api/
└── services/

migrations/
tests/
CODEOWNERS
```

The exact application is not important.

What matters is that we can demonstrate:

### Low-risk PR

Example:

``` text
Update README wording
Fix typo
Change documentation
```

### Medium-risk PR

Example:

``` text
Add validation to user profile endpoint
```

### High-risk PR

Example:

``` text
Modify authentication middleware
Change database migration
Modify payment webhook logic
```

This contrast is critical for the demo.

------------------------------------------------------------------------

# 9. Step 2 --- Set Up the GitHub Webhook

The webhook is the entry point to the system.

The GitHub flow should be:

``` text
PR opened
     │
     ▼
GitHub
     │
     ▼
POST /webhooks/github
     │
     ▼
Validate webhook secret
     │
     ▼
Process PR event
```

Initially, the endpoint does not need to perform AI analysis.

First make it simply:

1.  Receive the webhook.
2.  Validate the webhook.
3.  Identify the repository.
4.  Identify the PR.
5.  Identify the event/action.
6.  Log the payload.

### First milestone

You should be able to open/update a PR and see the webhook arrive
successfully.

The original build plan puts this in the first 4 hours alongside the
initial repository skeleton and Slack test notification.
fileciteturn0file0L129-L133

------------------------------------------------------------------------

# 10. Step 3 --- Connect to GitHub API

When the webhook arrives, use the GitHub API to retrieve the information
required for triage.

At minimum, retrieve:

``` text
PR title
PR description
Author
Repository
PR number
Branch information
Changed files
Diff / patch
PR state
Draft status
Labels if useful
```

The core requirement is to fetch the **full diff + PR description** when
the webhook fires. fileciteturn0file0L134-L137

------------------------------------------------------------------------

# 11. Step 4 --- Build the Diff Processing Layer

The LLM should not blindly receive an unlimited amount of repository
data.

Build a preprocessing step.

### Input

``` text
PR description
+
Changed files
+
Diff
+
Relevant repository context
```

### Processing

For normal PRs:

``` text
Raw diff
   ↓
Clean/normalize
   ↓
Send relevant content to LLM
```

For very large PRs:

``` text
Large diff
   ↓
Detect context limit
   ↓
Truncate intelligently
OR
summarize per-file
   ↓
Send compact representation
```

Large diffs are explicitly listed as an edge case that must be handled
during the polish phase. fileciteturn0file0L145-L148

------------------------------------------------------------------------

# 12. Step 5 --- Build the Groq AI Layer

The AI layer has **three primary responsibilities**.

## A. Intent summary

Convert the technical diff into plain English.

Example:

``` text
Input:
+47 -12 lines in webhook.py

Output:
"Adds retry logic to the payment webhook handler."
```

## B. Risk classification

Evaluate the PR based on:

-   Sensitive paths
-   Diff size
-   Test changes
-   Feature flags
-   Nature of the code changes
-   Other relevant diff signals

## C. Reviewer suggestion

Use repository ownership and review-history context to recommend
reviewer candidates.

------------------------------------------------------------------------

# 13. Structured AI Output

The AI response should be machine-readable JSON.

Recommended shape:

``` json
{
  "summary": "Adds retry logic to the payment webhook handler.",
  "risk": {
    "level": "HIGH",
    "score": 87,
    "reasons": [
      "Changes payment-related logic",
      "Touches production webhook handling",
      "No tests were added"
    ]
  },
  "reviewers": [
    {
      "username": "reviewer1",
      "reason": "Owns the affected payment module"
    },
    {
      "username": "reviewer2",
      "reason": "Reviewed recent PRs touching this area"
    }
  ]
}
```

The exact schema can be changed, but the application should always be
able to reliably parse:

-   Summary
-   Risk
-   Risk reasons
-   Reviewer suggestions

The project brief specifically recommends using Groq's JSON response
format to avoid fragile regex or Markdown parsing.
fileciteturn0file0L121-L126

------------------------------------------------------------------------

# 14. Groq Configuration

Recommended model:

``` text
llama-3.3-70b-versatile
```

Fallback:

``` text
llama-3.1-8b-instant
```

Recommended temperature:

``` text
0.1 – 0.3
```

A low temperature is preferred because this is primarily a
classification/triage task where consistency matters more than creative
generation. fileciteturn0file0L78-L79
fileciteturn0file0L124-L126

Use structured JSON output.

Conceptually:

``` text
System:
You are a PR triage assistant.
Return only valid JSON.

User:
PR metadata
PR description
Changed files
Diff
Risk rules
Reviewer context
```

------------------------------------------------------------------------

# 15. Step 6 --- Implement Deterministic Risk Signals

Do not make risk entirely dependent on the LLM.

Create a clear baseline rubric.

Example concept:

``` text
Path-based risk
    auth/       → high-risk signal
    migrations/ → high-risk signal
    payments/   → high-risk signal

Diff size
    small       → lower signal
    medium      → moderate signal
    large       → higher signal

Tests
    tests added/changed → positive confidence signal
    no tests            → risk signal

Feature flags
    present → contextual signal
```

Then combine:

``` text
Deterministic signals
        +
LLM judgment
        ↓
Final risk classification
```

The source plan explicitly recommends blending path-based rules with LLM
judgment. fileciteturn0file0L142-L144

### Important

The rubric does not have to be mathematically sophisticated.

It needs to be:

-   Explainable
-   Consistent
-   Demo-friendly
-   Easy to debug

------------------------------------------------------------------------

# 16. Step 7 --- Reviewer Recommendation

Reviewer selection is one of the main differentiators of this project.

Do not simply ask:

> "Who should review this?"

Instead gather evidence.

## Source 1 --- CODEOWNERS

If the repository contains:

``` text
CODEOWNERS
```

use it to determine ownership of changed files.

## Source 2 --- git blame

For files without useful CODEOWNERS information, inspect
authorship/ownership signals using `git blame`.

## Source 3 --- Recent review history

Look at recent PR history for the affected files.

The source plan specifically proposes using:

> "who reviewed the last 5 PRs on these files"

as one of the reviewer-selection signals.
fileciteturn0file0L138-L141

## Candidate ranking

Conceptually:

``` text
Candidate reviewer
       │
       ├── CODEOWNER?
       ├── Frequently touched this file?
       ├── Reviewed recent PRs?
       └── Relevant module expertise?
       │
       ▼
Reviewer score
       │
       ▼
Top candidate(s)
```

The result should include a **reason**, not just a username.

Example:

``` text
Suggested reviewer: @alex

Why:
- CODEOWNER for payments/
- Reviewed 4 of the last 5 PRs touching this module
```

This makes the recommendation understandable and defensible.

------------------------------------------------------------------------

# 17. Step 8 --- Build the Slack Notification

Slack is the visual centerpiece of the demo.

The message should be immediately understandable.

Example structure:

``` text
🚦 PR TRIAGE

PR #42 — Add retry handling to payment webhook

📝 Summary
Adds retry logic to payment webhook processing.

⚠️ Risk
HIGH — 87/100

Why?
• Changes payment logic
• Touches webhook handling
• No tests added

👤 Suggested Reviewer
@alex

Why?
• CODEOWNER for payments/
• Reviewed recent payment PRs

🔗 View PR
```

The source plan explicitly calls for a structured card containing
summary, risk score, and suggested reviewer, and later calls Slack
formatting the demo's visual centerpiece. fileciteturn0file0L16-L18
fileciteturn0file0L145-L148

------------------------------------------------------------------------

# 18. Step 9 --- Implement Stale-PR Detection

The system should periodically check open PRs.

For the hackathon, this can be simulated with a cron/timer.

Example:

``` text
Every N minutes
      ↓
Find open PRs
      ↓
Check last review activity
      ↓
Is PR stale?
      │
      ├── No → nothing
      │
      └── Yes
            ↓
       Send Slack nudge
```

The source implementation plan explicitly allows a simulated cron/timer
for the demo. fileciteturn0file0L25-L28

------------------------------------------------------------------------

# 19. Risk-Aware Escalation

Staleness should not treat every PR equally.

Conceptually:

``` text
LOW RISK
    ↓
Normal reminder after stale period

MEDIUM RISK
    ↓
Earlier reminder

HIGH RISK
    ↓
Faster escalation
```

The project plan specifically says to escalate faster for high-risk PRs.
fileciteturn0file0L142-L144

For the demo, the stale threshold can be shortened/simulated so judges
can see the behavior without waiting a real day.

The intended real-world example is a re-ping when a PR receives no
review after roughly 24 hours, with faster escalation for high-risk
changes. fileciteturn0file0L16-L18

------------------------------------------------------------------------

# 20. PR State Tracking

The stale checker needs enough state to know what happened.

Keep it simple.

Possible JSON state:

``` json
{
  "repo:pr-42": {
    "lastSeen": "2026-08-29T12:00:00Z",
    "lastReviewActivity": "2026-08-29T12:30:00Z",
    "risk": "HIGH",
    "lastNudge": null
  }
}
```

Possible storage options:

### Option A --- In-memory

Fastest implementation.

Good for:

-   Local demo
-   Temporary state

### Option B --- JSON file

Simple persistence without database setup.

### Option C --- SQLite

Use only if the application genuinely needs it.

The original plan recommends SQLite only as an optional state store and
says in-memory/JSON can be enough. fileciteturn0file0L67-L70

------------------------------------------------------------------------

# 21. Edge Cases We Must Handle

Do not wait until the final hour to discover these.

## PR has no description

The agent should still analyze the diff.

Fallback:

``` text
Summary generated from code changes.
```

## Draft PR

Decide whether to:

-   Analyze but mark as draft
-   Skip notification
-   Notify with a draft label

Keep the behavior explicit.

## Force-push

A PR's diff may change after the original webhook.

The system should safely re-fetch the current PR state rather than
assuming the old diff is still valid.

## Large diff

Do not send an enormous diff blindly to the model.

Use:

-   Truncation
-   Per-file summaries
-   Relevant-file prioritization

## No CODEOWNERS

Fall back to:

-   `git blame`
-   Review history
-   LLM reasoning

## No review history

Still recommend based on:

-   CODEOWNERS
-   Ownership signals
-   Changed-file context

## No suitable reviewer

Return something explicit such as:

``` text
No strong reviewer match found.
```

Do not invent a reviewer.

These edge cases are explicitly included in the source plan's polish
phase. fileciteturn0file0L145-L148

------------------------------------------------------------------------

# 22. Development Milestones

## Milestone 1 --- Webhook works

**Input:**

``` text
GitHub PR event
```

**Output:**

``` text
Server receives and logs event
```

------------------------------------------------------------------------

## Milestone 2 --- GitHub data retrieval works

**Input:**

``` text
PR event
```

**Output:**

``` text
PR metadata
+
description
+
files
+
diff
```

------------------------------------------------------------------------

## Milestone 3 --- AI summary works

**Input:**

``` text
PR description + diff
```

**Output:**

``` text
Plain-English summary
```

------------------------------------------------------------------------

## Milestone 4 --- Risk classification works

**Input:**

``` text
PR + diff + deterministic signals
```

**Output:**

``` text
Risk score
+
risk level
+
reasons
```

------------------------------------------------------------------------

## Milestone 5 --- Reviewer recommendation works

**Input:**

``` text
Changed files
+
CODEOWNERS
+
blame
+
recent reviews
```

**Output:**

``` text
Reviewer candidates
+
reasons
```

------------------------------------------------------------------------

## Milestone 6 --- Slack works

**Input:**

``` text
Analysis result
```

**Output:**

``` text
Formatted Slack card
```

------------------------------------------------------------------------

## Milestone 7 --- Stale checker works

**Input:**

``` text
Open PR state
```

**Output:**

``` text
Reminder/escalation
```

------------------------------------------------------------------------

## Milestone 8 --- End-to-end demo works

``` text
Open PR
   ↓
Webhook
   ↓
GitHub API
   ↓
Risk + Summary + Reviewer
   ↓
Slack card
   ↓
Stale escalation
```

At this point, **stop adding features** and focus on reliability and
presentation.

------------------------------------------------------------------------

# 23. 48-Hour Build Plan

The original implementation plan divides the project into the following
stages. fileciteturn0file0L129-L159

## Hours 0--4 --- Setup & Skeleton

### Tasks

-   Create repository
-   Set up project
-   Start LatentCode session
-   Configure environment variables
-   Create GitHub webhook endpoint
-   Log incoming PR payload
-   Configure Slack webhook
-   Send hardcoded Slack test message

### Done when

``` text
GitHub → backend
```

works and:

``` text
Backend → Slack
```

works independently.

------------------------------------------------------------------------

# Hours 4--12 --- Core Pipeline

### Tasks

-   Fetch PR metadata
-   Fetch PR description
-   Fetch full diff
-   Process webhook events
-   Connect Groq
-   Create triage prompt
-   Generate summary
-   Generate risk classification
-   Parse structured JSON
-   Send result to Slack

### Done when

A real PR produces:

``` text
PR
→ summary
→ risk
→ Slack
```

------------------------------------------------------------------------

# Hours 12--20 --- Reviewer Suggestion

### Tasks

-   Read `CODEOWNERS`
-   Add `git blame` support where useful
-   Retrieve recent PR/review history
-   Identify reviewer candidates
-   Rank candidates
-   Add reviewer rationale
-   Include recommendation in Slack card

### Done when

A PR touching a known module produces a sensible reviewer
recommendation.

------------------------------------------------------------------------

# Hours 20--30 --- Risk Refinement + Stale Nudges

### Tasks

-   Define path-based risk rules
-   Add diff-size signal
-   Add test-change signal
-   Add feature-flag signal
-   Blend deterministic scoring with LLM judgment
-   Track open PR state
-   Build periodic stale checker
-   Implement escalation behavior
-   Make high-risk PRs escalate faster

### Done when

The system can demonstrate:

``` text
Low-risk PR → low priority

High-risk PR → high priority + faster escalation
```

------------------------------------------------------------------------

# Hours 30--38 --- Polish & Edge Cases

### Tasks

-   Handle large diffs
-   Handle missing descriptions
-   Handle force-pushes
-   Handle draft PRs
-   Improve error handling
-   Improve retry behavior where necessary
-   Improve Slack formatting
-   Remove noisy logs
-   Make output presentation polished

### Critical priority

**Slack formatting matters.**

This is the part judges will see during the demo.

------------------------------------------------------------------------

# Hours 38--44 --- Demo Preparation

### Tasks

-   Create realistic demo PRs
-   Create one trivial PR
-   Create one risky PR
-   Verify reviewer recommendations
-   Verify Slack formatting
-   Test stale escalation
-   Prepare 2-minute video
-   Write README
-   Prepare architecture diagram

The source plan specifically recommends seeding the demo repository with
realistic PRs that show the contrast between trivial and risky changes.
fileciteturn0file0L149-L153

------------------------------------------------------------------------

# Hours 44--48 --- Submission

### Checklist

-   [ ] Make repository public
-   [ ] Verify README
-   [ ] Verify demo video
-   [ ] Export LatentCode session transcript
-   [ ] Every coding team member exports their transcript individually
-   [ ] Upload demo video
-   [ ] Upload transcripts to shared Google Drive
-   [ ] Set Drive access to "Anyone with the link can view"
-   [ ] Test Drive links in incognito
-   [ ] Post Build in Public update
-   [ ] Tag `@LatentForce`
-   [ ] Submit Google Form
-   [ ] Team lead performs final submission

These submission requirements come directly from the source plan.
fileciteturn0file0L154-L159

------------------------------------------------------------------------

# 24. Definition of Done

The project is **not done** merely because the API works.

The MVP is complete only when all of these are true:

## Core functionality

-   [x] GitHub webhook receives PR events
-   [x] Webhook secret is validated
-   [x] PR metadata is retrieved
-   [x] PR description is retrieved
-   [x] PR diff is retrieved
-   [x] Large diffs are handled
-   [x] Groq analysis works
-   [x] Summary is generated
-   [x] Risk is generated
-   [x] Risk reasons are generated
-   [x] Reviewer candidates are generated
-   [x] Reviewer reasoning is generated
-   [x] Slack notification is sent
-   [x] Stale PRs are detected
-   [x] Stale PRs trigger reminders
-   [x] High-risk PRs receive faster escalation

## Reliability

-   [x] Missing PR description does not crash the system
-   [x] Missing CODEOWNERS does not crash the system
-   [x] Empty reviewer history does not crash the system
-   [x] Large diffs do not crash the system
-   [x] Force-pushes are handled
-   [x] Draft PR behavior is defined
-   [x] Invalid AI output is handled
-   [x] API failures are handled
-   [x] Secrets are not committed

## Demo

-   [x] Demo repository is public
-   [x] Low-risk PR exists
-   [x] High-risk PR exists
-   [x] Slack card looks polished
-   [x] Reviewer recommendation is understandable
-   [x] Stale escalation can be demonstrated
-   [x] End-to-end flow works live
-   [x] Demo fits within 2 minutes

------------------------------------------------------------------------

# 25. Testing Strategy

Test each component separately before doing the live demo.

## Test 1 --- Webhook

``` text
Create PR
↓
Webhook received?
```

Expected:

``` text
YES
```

------------------------------------------------------------------------

## Test 2 --- GitHub API

``` text
Webhook
↓
Fetch PR
↓
Fetch diff
```

Expected:

``` text
Correct PR data
Correct changed files
Correct diff
```

------------------------------------------------------------------------

## Test 3 --- Groq

Use a known test PR.

Expected JSON:

``` text
summary
risk
reasons
reviewers
```

No Markdown wrapping.

------------------------------------------------------------------------

## Test 4 --- Risk

Create two PRs:

### PR A

``` text
README typo
```

Expected:

``` text
LOW
```

### PR B

``` text
payment/auth/migration change
```

Expected:

``` text
HIGH
```

The exact score is less important than producing a sensible, explainable
ranking.

------------------------------------------------------------------------

## Test 5 --- Reviewer

Create a repository with:

``` text
CODEOWNERS
```

and known review history.

Expected:

``` text
Reviewer with relevant ownership/history
```

------------------------------------------------------------------------

## Test 6 --- Slack

Verify:

-   Summary is readable
-   Risk is obvious
-   Risk reasons are visible
-   Reviewer is obvious
-   PR link works
-   Formatting is compact

------------------------------------------------------------------------

## Test 7 --- Stale PR

Simulate a stale timestamp rather than waiting for a real 24-hour
period.

Expected:

``` text
Stale PR
↓
Reminder
```

Then verify:

``` text
High-risk stale PR
↓
Earlier/faster escalation
```

------------------------------------------------------------------------

# 26. AI Prompt Design

The prompt should make the model act as a **triage assistant**, not a
generic coding assistant.

Core instruction:

``` text
You are a PR triage assistant.

Analyze the supplied pull request and return only valid JSON.

Determine:
1. What the PR is trying to accomplish.
2. How risky the change is.
3. Why the change has that risk.
4. Which reviewer(s) are best suited to review it.
5. Why those reviewers are appropriate.

Use only the supplied repository and PR evidence.
Do not invent reviewers or repository facts.
```

Then provide:

``` text
PR metadata
PR description
Changed files
Diff
Risk signals
CODEOWNERS information
Review history
Ownership information
```

Keep the temperature low.

------------------------------------------------------------------------

# 27. Risk Model

A useful conceptual model is:

``` text
                 ┌──────────────────┐
                 │  Changed Paths   │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │    Diff Size     │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │   Test Changes   │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ Feature Flags    │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │   LLM Judgment   │
                 └────────┬─────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ FINAL RISK   │
                  └──────────────┘
```

The important principle is:

> **The risk result must be explainable.**

A judge should be able to ask:

> "Why is this high risk?"

and the Slack card should immediately answer.

------------------------------------------------------------------------

# 28. Reviewer Model

The reviewer system should follow:

``` text
Changed Files
      │
      ├──────────────► CODEOWNERS
      │
      ├──────────────► git blame
      │
      └──────────────► Recent PR Reviews
                             │
                             ▼
                     Candidate Reviewers
                             │
                             ▼
                       Rank Candidates
                             │
                             ▼
                    Best-fit Reviewer(s)
```

The final recommendation should explain **why**.

Example:

``` text
Recommended:
@developer123

Evidence:
✓ CODEOWNER for src/payments/
✓ Reviewed 4/5 recent PRs in this area
✓ Frequently authors changes to this module
```

------------------------------------------------------------------------

# 29. Slack Card Design

The Slack card should prioritize information in this order:

``` text
1. PR
2. Risk
3. Summary
4. Why it is risky
5. Reviewer
6. Why reviewer was selected
7. Link to PR
```

Avoid dumping:

-   Full diff
-   Huge AI output
-   Long explanations
-   Raw JSON

Slack is the **decision surface**, not the debugging console.

------------------------------------------------------------------------

# 30. Error Handling

The application should degrade gracefully.

## GitHub API fails

``` text
Retry if appropriate
Log error
Do not crash server
```

## Groq API fails

``` text
Log failure
Send fallback Slack message if useful
Do not lose webhook processing
```

## AI returns invalid JSON

``` text
Parse failure
Retry/handle gracefully
```

## Slack fails

``` text
Log failure
Preserve triage result
```

## Reviewer data unavailable

``` text
Continue with risk + summary
Return:
"No strong reviewer match found."
```

The system should never fabricate confidence simply because a downstream
component failed.

------------------------------------------------------------------------

# 31. Demo Story

The demo should tell a simple story.

## Before

Show a messy PR queue.

Say:

> "Today, PRs are often reviewed in submission order. A critical change
> can sit behind trivial fixes, and the right reviewer may never be
> automatically pulled in."

This directly reflects the problem framing in the project brief.
fileciteturn0file0L4-L9

## Then

Open a risky PR.

Example:

``` text
Modify payment webhook
```

## Show

Within seconds:

``` text
GitHub PR
   ↓
Agent
   ↓
Slack
```

Then show:

``` text
HIGH RISK
87/100

Summary:
Adds retry handling to payment webhook processing.

Suggested reviewer:
@alex

Reason:
CODEOWNER + recent review history
```

## Finish

Show stale escalation:

``` text
PR still unreviewed
        ↓
Agent detects staleness
        ↓
Slack escalation
```

The entire video must be **2 minutes or less**. The source explicitly
says the demo video is hard-capped at two minutes.
fileciteturn0file0L172-L176

------------------------------------------------------------------------

# 32. Judging Strategy

The judging rubric from the source is:

  ------------------------------------------------------------------------
  Category                                    Weight What We Need to
                                                     Demonstrate
  --------------------- ---------------------------- ---------------------
  Idea & Innovation                              30% Risk-aware routing,
                                                     not just PR
                                                     summarization

  Execution                                      30% Real GitHub → agent →
                                                     Slack flow

  Usefulness & Impact                            25% Reduce review latency
                                                     and blind spots

  Presentation & Demo                            10% Strong before/after
                                                     story

  Build in Public                                 5% Early public progress
  ------------------------------------------------------------------------

These weights and the corresponding judging guidance are defined in the
project plan. fileciteturn0file0L160-L171

------------------------------------------------------------------------

# 33. How We Should Position the Idea

## Do NOT pitch it as:

> "An AI bot that summarizes pull requests."

That sounds generic.

## Pitch it as:

> **"A risk-aware PR triage agent that identifies what needs attention
> first and automatically routes it to the people most likely to review
> it."**

The differentiator is:

``` text
PR Summary
      +
Risk Awareness
      +
Reviewer Routing
      +
Stale Escalation
```

The source explicitly says the innovation should be framed around
**risk-aware routing that reduces review latency and blind spots**,
rather than simply "AI writes a summary."
fileciteturn0file0L160-L162

------------------------------------------------------------------------

# 34. Architecture Diagram for README/Demo

Use this architecture as the primary project diagram:

``` text
┌──────────────────────┐
│     GitHub PR        │
│   Open / Update      │
└──────────┬───────────┘
           │
           │ Webhook
           ▼
┌──────────────────────┐
│   Webhook Receiver   │
│ Express / FastAPI    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   GitHub API Layer   │
│                      │
│ • PR metadata        │
│ • Description        │
│ • Full diff          │
│ • CODEOWNERS         │
│ • Review history     │
│ • Blame/ownership    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Triage Engine     │
│                      │
│ ┌──────────────────┐ │
│ │ Risk Rules       │ │
│ └────────┬─────────┘ │
│          +            │
│ ┌────────▼─────────┐ │
│ │ Groq LLM         │ │
│ └────────┬─────────┘ │
│          │            │
│   Summary             │
│   Risk                │
│   Reviewer            │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│        Slack         │
│   Triage Card        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Stale PR Checker    │
│    Cron / Timer      │
└──────────────────────┘
```

This follows the architecture supplied in the project brief: webhook
receiver → GitHub diff/metadata → Groq analysis → Slack poster →
scheduled stale check. fileciteturn0file0L33-L53

------------------------------------------------------------------------

# 35. What We Should NOT Build

To protect the 48-hour schedule, avoid:

``` text
❌ Dashboard
❌ React frontend
❌ Multi-repo architecture
❌ User authentication system
❌ ML training pipeline
❌ Complex database
❌ Custom Slack application unless necessary
❌ Advanced analytics
❌ Huge configuration system
❌ Kubernetes
❌ Microservices
❌ Over-engineered deployment
```

Build the smallest reliable system that creates the strongest demo.

------------------------------------------------------------------------

# 36. Demo Reliability Checklist

Before recording:

## GitHub

-   [ ] Repository is accessible
-   [ ] Webhook is active
-   [ ] Webhook secret works
-   [ ] PR events arrive
-   [ ] API token works

## Groq

-   [ ] API key works
-   [ ] Model works
-   [ ] JSON output is valid
-   [ ] Prompt is stable
-   [ ] Rate limits are understood

Groq's free tier has request/token rate limits, so avoid repeatedly
hammering the API immediately before recording.
fileciteturn0file0L121-L126

## Slack

-   [ ] Webhook works
-   [ ] Correct channel
-   [ ] Card formatting looks good
-   [ ] Links work
-   [ ] Risk is visually obvious

## Demo

-   [ ] Low-risk PR prepared
-   [ ] High-risk PR prepared
-   [ ] Reviewer evidence prepared
-   [ ] Stale PR state prepared
-   [ ] Demo sequence rehearsed
-   [ ] Video is under 2 minutes

------------------------------------------------------------------------

# 37. Final Submission Checklist

``` text
PROJECT
[ ] MVP complete
[ ] End-to-end pipeline works
[ ] Repository public
[ ] README complete
[ ] Secrets removed
[ ] .env.example included

DEMO
[ ] Real GitHub PR
[ ] Real Slack notification
[ ] Risk classification visible
[ ] Reviewer recommendation visible
[ ] Stale escalation visible
[ ] Video <= 2 minutes

LATENTCODE
[ ] Session transcript exported
[ ] Every coding team member exported their transcript

GOOGLE DRIVE
[ ] Demo video uploaded
[ ] Transcripts uploaded
[ ] "Anyone with the link can view"
[ ] Incognito access tested

BUILD IN PUBLIC
[ ] Early progress post made
[ ] @LatentForce tagged
[ ] Progress shown before final reveal

SUBMISSION
[ ] Google Form completed
[ ] Team lead submitted
```

The source plan specifically calls for a public repository, individual
LatentCode transcript exports, shared Drive uploads with link access
tested in incognito, a Build in Public post tagging `@LatentForce`, and
a team-lead-only Google Form submission. fileciteturn0file0L154-L159

------------------------------------------------------------------------

# 38. Final Success Criteria

The project succeeds if a judge can understand the entire value
proposition in approximately two minutes:

``` text
                 BEFORE

PR queue
   ↓
First come, first served
   ↓
Trivial PRs reviewed first
   ↓
Risky PR waits
   ↓
Wrong/unknown reviewer
```

versus:

``` text
                 AFTER

PR opened
   ↓
AI triage agent
   ↓
"What changed?"
   ↓
"How risky is it?"
   ↓
"Who should review it?"
   ↓
Slack alert
   ↓
Stale escalation
```

### The final product should prove three things:

#### 1. **Prioritization**

The team knows which PR deserves attention first.

#### 2. **Routing**

The team knows who should review it.

#### 3. **Escalation**

The team is reminded when an important PR remains unreviewed.

That is the core product.

------------------------------------------------------------------------

# 39. The One-Sentence Product Definition

> **A GitHub-to-Slack AI agent that turns raw pull requests into
> risk-aware review decisions: what changed, how dangerous it is, who
> should review it, and when to escalate if nobody does.**

------------------------------------------------------------------------

# 40. Final Principle

**Do not optimize for the number of features. Optimize for the strength
of the live end-to-end moment.**

The strongest possible demo is:

``` text
REAL PR
   ↓
REAL WEBHOOK
   ↓
REAL ANALYSIS
   ↓
REAL RISK SCORE
   ↓
REAL REVIEWER RECOMMENDATION
   ↓
REAL SLACK CARD
   ↓
REAL STALE ESCALATION
```

If that flow is fast, reliable, understandable, and visually polished,
the project directly demonstrates the core problem, solution,
implementation, usefulness, and judging criteria defined by the
BuildSprint brief.
