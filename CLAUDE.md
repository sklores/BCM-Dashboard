@AGENTS.md

# BCM Dashboard

Construction project management web app. Standalone repo, separate from And Done, but follows the same DAW/plugin module architecture.

First client and proof of concept: **BCM Construction**.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth)
- Vercel (hosting)

## Auth

- **Beta:** Supabase email/password
- **v2:** Microsoft SSO

`users.id` is **not** linked to `auth.users` during beta — kept standalone. Do not add that FK until v2 work begins.

## Data ingestion

- **Beta:** drag-and-drop OneDrive folder import
- **v2:** Microsoft Graph API

## Roles

- **Owner** — God Mode (full access to everything)
- **PM** — Project Manager
- **APM** — Assistant Project Manager
- **Super** — mobile-only, lands in phase two

## Layout

Desktop only for now. Two persistent navigation surfaces:

- **Top horizontal bar** — job site address + dropdown to switch projects
- **Right vertical bar** — 13 module tabs

## Modules

Each module is a **self-contained plugin** with its own data model, UI, role permissions, and on/off switch (`modules.enabled`). Inspired by DAW plugin architecture from And Done.

The 14 modules:

1. Reports
2. Materials
3. Subs
4. Team
5. Tasks
6. Photos
7. Budget
8. Schedule
9. Plans
10. Permits
11. Notes
12. Messages
13. Calendar
14. Client

### Module data sources

A module's data source is one of:

- **OneDrive viewer** — read-only surface over a OneDrive file/folder
- **Supabase** — native tables in our Postgres schema
- **Hybrid** — combines both

### Module-specific notes

- **Schedule** — ground-up Gantt build. Import path: OCR from MS Project PDFs.
- **Budget** — syncs with existing OneDrive Excel files (do not duplicate the source of truth).

## Phase two

Mobile **Super** companion app. Not in scope for beta, but architecture must be future-proofed: keep module logic decoupled from desktop UI, keep role permissions data-driven, keep API surfaces consumable from a separate client.
