# PR Review Triage Agent
#done by ankush adhikari

> **A GitHub-to-Slack AI agent that turns raw pull requests into risk-aware review decisions: what changed, how dangerous it is, who should review it, and when to escalate if nobody does.**

---

## Overview

In growing engineering teams, pull request queues operate on a first-come, first-served basis. High-risk authentication or payment changes wait behind trivial documentation edits, while appropriate code owners are not automatically brought into reviews.

**PR Review Triage Agent** solves this by automatically processing GitHub pull request webhooks and delivering actionable Slack triage cards powered by Groq AI (`llama-3.3-70b-versatile`) and multi-factor risk scoring.

### Key Capabilities

1. **Plain-English Intent Summary:** Converts technical diffs and pull request descriptions into concise, clear summaries of intent.
2. **Hybrid Risk Scoring:** Combines deterministic rules (sensitive paths like `/auth`, `/payments`, database migrations, diff size, test coverage) with LLM judgment to classify PR risk as `LOW`, `MEDIUM`, or `HIGH`.
3. **Smart Reviewer Routing:** Cross-references `CODEOWNERS`, file ownership history, and recent pull request review patterns to assign the best-fit reviewer with explicit rationale.
4. **Risk-Aware Stale PR Escalation:** Monitors open PRs and escalates overdue reviews to Slack, accelerating escalation windows for high-risk changes (e.g. 6 hrs for High Risk vs 24 hrs for Low/Medium Risk).

---

## Architecture

```
┌──────────────────────┐
│     GitHub PR        │
│   Open / Update      │
└──────────┬───────────┘
           │
           │ Webhook (HMAC SHA-256)
           ▼
┌──────────────────────┐
│   Webhook Receiver   │
│   Express (Node.js)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   GitHub API Layer   │
│ • PR Metadata        │
│ • Full Diff          │
│ • CODEOWNERS         │
│ • Review History     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Triage Engine     │
│ ┌──────────────────┐ │
│ │ Risk Scoring     │ │
│ └────────┬─────────┘ │
│          │           │
│ ┌────────▼─────────┐ │
│ │ Groq LLM         │ │
│ │ Llama-3.3-70b    │ │
│ └────────┬─────────┘ │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│        Slack         │
│  Triage Block Card   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Stale PR Checker    │
│    Cron / Timer      │
└──────────────────────┘
```

---

## Quickstart & Setup

### Prerequisites
- Node.js v18+
- GitHub Account & Personal Access Token
- Groq API Key
- Slack Incoming Webhook URL

### 1. Installation

```bash
git clone https://github.com/your-org/pr-review-triage-agent.git
cd pr-review-triage-agent
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your configuration values in `.env`:

```env
GITHUB_TOKEN=ghp_your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GROQ_API_KEY=gsk_your_groq_api_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PORT=3000
```

### 3. Run Development Server

```bash
npm start
```

For live local webhook testing with GitHub, run ngrok:
```bash
ngrok http 3000
```
Set your GitHub Repository Webhook URL to `https://your-ngrok-subdomain.ngrok-free.app/webhooks/github` for `Pull request` events.

---

## Testing & Simulation

### Unit Tests
Run unit tests for risk scoring, CODEOWNERS parsing, reviewer ranking, and Slack formatting:

```bash
npm test
```

### Local E2E Simulation
Run an end-to-end simulation comparing a **Low-Risk Documentation PR** against a **High-Risk Payment Webhook PR** with automated stale escalation:

```bash
npm run simulate
```

---

## Project Structure

```
pr-review-triage-agent/
├── src/
│   ├── index.js          # Express server entry point & cron scheduler
│   ├── ai/
│   │   └── triage.js     # Groq API client & prompt orchestration
│   ├── github/
│   │   ├── client.js     # GitHub API, CODEOWNERS & review history fetcher
│   │   └── diff.js       # Diff normalization & truncation preprocessor
│   ├── reviewer/
│   │   └── ranking.js    # Reviewer candidate scoring & ranking engine
│   ├── risk/
│   │   └── scoring.js    # Deterministic risk engine & score blender
│   ├── server/
│   │   └── webhook.js    # Webhook listener & HMAC validator
│   ├── slack/
│   │   └── notifier.js   # Slack Block Kit payload builder & sender
│   └── stale/
│       ├── checker.js    # Periodic stale PR scanner & escalator
│       └── state.js      # Persistent JSON state store
├── scripts/
│   └── simulate.js       # E2E simulation script
├── tests/
│   └── triage.test.js    # Node native test runner suite
├── .env.example
├── GUIDE.md
└── package.json
```
