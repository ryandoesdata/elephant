# elephant

Spaced-repetition practice tool for classical musicians. You practice a piece in small segments; adjacent mastered segments automatically merge into larger ones until the whole piece is memorized.

## Stack

- **Frontend** — React + Vite, React Router v6, TanStack Query
- **Backend** — Express + TypeScript, PostgreSQL (raw `pg`), Zod
- **Algorithm** — SM-2 spaced repetition, 21-day mastery threshold

## Prerequisites

- Node.js 18+
- PostgreSQL running locally

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the database
createdb memorizeit

# 3. Copy env and adjust if needed
cp .env.example .env

# 4. Run migrations
npm run migrate --workspace=server

# 5. (Optional) Seed with Mendelssohn Violin Concerto Op. 64
npm run seed --workspace=server
```

## Running

```bash
npm run dev
```

Starts both servers concurrently:
- Client: http://localhost:5173
- API: http://localhost:3001

## How it works

Each piece is divided into fixed-size phrases (segments). Every phrase gets its own SM-2 review card. When you rate a session, the algorithm schedules the next review. Once two adjacent phrases are both mastered (interval ≥ 21 days), they automatically merge into a single longer phrase — and you start practicing the join. This continues until the whole piece is one card.

You can also manually break a phrase into two shorter ones or merge any two adjacent phrases from the piece detail page.
