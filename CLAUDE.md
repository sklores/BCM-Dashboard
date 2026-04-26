@AGENTS.md

# BCM Dashboard

Construction project management web app. Standalone repo, separate from And Done, but follows the same DAW/plugin module architecture.

First client and proof of concept: **BCM Construction**.

## Layout

Desktop only for now. Two persistent navigation surfaces:

- **Top horizontal bar** — job site address + dropdown to switch projects
- **Right vertical bar** — module tabs

## FINAL MODULE LIST - 16 TABS IN THIS ORDER

1. Reports
2. Estimating
3. Paperwork
4. Materials
5. Contractors
6. Contacts
7. Tasks
8. Photos
9. Budget
10. Schedule
11. Plans
12. Permits
13. Notes
14. Calendar
15. Messages
16. Billing

## MODULE ARCHITECTURE

Every module is a self-contained plugin following the DAW plugin model. Each module has its own data model, UI, role permissions, and on/off switch. Modules communicate through shared Supabase tables and a global alerts table. No module modifies another modules UI or core logic.

## ESTIMATING MODULE

Two sections: Estimate Builder and Bid Leveling.

Estimate Builder: line items with description, quantity, unit, unit cost, total. Cost plus structure with configurable fee as fixed amount or percentage. Export as branded PDF proposal for client. Status tracking per estimate.

Bid Leveling: send RFPs to subs pulled from Subs module, receive and manually enter bid responses, level sheet builder with line items per trade and one column per sub, lowest number per line item highlighted green, highest highlighted red, missing items flagged, award button triggers subcontractor agreement creation in Paperwork module.

## PAPERWORK MODULE

Document factory. Seven document types generated from templates pre-populated with existing project data. User fills gaps, exports as PDF, optionally sends via DocuSign.

Document types:

- Client Contract: pulls from project record, project address, contract terms
- Subcontractor Agreement: pulls from Subs module, scope, contract value, triggered automatically from Bid Leveling award
- SOW: pulls from Schedule phases and tasks for selected sub
- RFP: pulls from Subs module, trade, scope written fresh per request
- Client Proposal: pulls from Estimating data, simple or detailed version
- Requisition: pulls from Billing, schedule of values
- Change Order: pulls from Contracts data and Billing

All generated documents stored in Supabase with project reference, document type, status, and PDF url.

DocuSign API integrated in v1 for send and signature tracking. Status: Draft, Sent, Signed, Fully Executed.

Company boilerplate set once globally: logo, company name, years in business, mission statement, portfolio highlights, standard terms.

## BILLING MODULE

Three sections: Client Billing, Sub Requisitions, Change Orders.

Client Billing: monthly pay applications, G702/G703 auto-generation, payment status tracking, retainage tracking, running totals.

Sub Requisitions: incoming sub pay apps, approval workflow, cross-referenced against Schedule to detect overbilling, retainage per sub, writes to global alerts table on overbilling detection.

Change Orders: full log with status, affects client and/or sub contract, approved change orders update revised contract value in Client Billing.

## PLANS MODULE

Four sections: Drawings, RFIs, Submittals, Annotations.

Drawings: drag and drop PDF upload, drawing types include Architectural, Structural, MEP, Civil, Shop Drawings, Stamped, Horizontal and custom types, revision tracking, current vs superseded status, inline PDF viewer with zoom and pan, Claude vision Ask AI button, pin tool for dropping numbered pins linked to RFIs or annotations.

RFIs: created from drawing pins or manually, surfaces in both Plans and Messages as a thread, fields include RFI number, drawing reference, question, response, status, assigned to.

Submittals: full submittal log, status tracking, rejection writes to global alerts table.

Annotations: all pins across all drawings in one list.

## MESSAGES MODULE

Inbound project email via Postmark webhook. Each project has auto-generated email address from street address. All project members see full thread. V2 adds super field messages from mobile. V3 adds Microsoft Graph API.

## SCHEDULE MODULE

Three views: Simple Gantt, Detailed Gantt, Milestone.

Simple Gantt: major phases, color coded by status, today line, fits one screen.

Detailed Gantt: four levels deep Phase, Task, Subtask, Material Card. Soft dependencies with dual indicators. Three zoom levels Weekly Monthly Full Project. Today line. Inline editing for Owner and PM only.

Material card fields: product name, manufacturer, supplier, lead time, installation instructions as free text and PDF attachment. No pricing on schedule view.

Milestone View: key dates, shareable public read-only link.

OCR import: one time onboarding, upload MS Project PDF, Claude vision extracts tasks and dates.

Alerts: writes to global alerts table when soft dependency risk detected.

## GLOBAL ALERTS TABLE

Schema: id uuid, project_id uuid references projects, module_key text, event_type text, message text, created_at timestamptz.

Event types currently defined: task_at_risk from Schedule, sub_overbilling from Billing, submittal_action_required from Plans.

This table is the event bus for all future notifications including mobile push, automated reports, and email alerts.

## CROSS MODULE CONNECTION MAP

- Schedule → Billing: sub requisitions validated against task completion status
- Schedule → Alerts: delayed tasks with dependent tasks trigger alerts
- Messages → Billing: sub requisition emails received in Messages reviewed in Billing
- Paperwork → Subs: subcontractor agreements pull sub data
- Paperwork → Schedule: SOW pulls from schedule phases
- Paperwork → Billing: requisitions pull from billing data
- Estimating → Paperwork: bid leveling award triggers subcontractor agreement
- Billing → Alerts: sub overbilling triggers alert
- Plans → Messages: RFI creation writes thread to Messages
- Plans → Alerts: submittal rejection triggers alert
- All modules → Alerts: global event bus

## DOCUSIGN

Integrated in v1. Used in Paperwork module for sending and tracking signatures on all document types. Status tracking: Draft, Sent, Signed, Fully Executed. Sandbox credentials stored in environment variables.

## MICROSOFT INTEGRATIONS ROADMAP

- V1: Supabase auth email/password, Postmark inbound email, OneDrive drag and drop
- V2: Microsoft SSO, Microsoft Graph API for OneDrive and Outlook
- V3: Microsoft Teams integration

## MOBILE COMPANION APP

Phase two. Supers only. Daily logs, photo capture, task updates, field messages. Alerts table, messages table, and user roles already designed to support mobile.

## TECH STACK

Next.js, TypeScript, Tailwind CSS, Supabase, Vercel, GitHub. Separate standalone repo from And Done.

## AUTH

V1: Supabase email/password. V2: Microsoft SSO.

`users.id` is **not** linked to `auth.users` during beta — kept standalone. Do not add that FK until v2 work begins.

## ROLES

- **Owner**: God Mode, full access all projects
- **PM**: full access assigned projects
- **APM**: view only, limited editing
- **Super**: mobile only phase two

## BCM CONSTRUCTION

First client, proof of concept. 12M per year owner operator. Uses OneDrive, Microsoft 365, Microsoft Project, DocuSign. Pain points: scattered OneDrive, manual billing and requisition process, sub requisition review against schedule is manual, document generation is slow and lives in email and Excel.
