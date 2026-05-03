export type DocCategory =
  | "reports"
  | "contracts"
  | "financial"
  | "client_facing";

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  reports: "Reports",
  contracts: "Contracts & Agreements",
  financial: "Financial",
  client_facing: "Client Facing",
};

export type DocStatus = "draft" | "finalized" | "sent";

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft",
  finalized: "Finalized",
  sent: "Sent",
};

export const DOC_STATUS_STYLE: Record<DocStatus, string> = {
  draft: "border-zinc-700 bg-zinc-900 text-zinc-400",
  finalized: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  sent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export type GeneratedDocument = {
  id: string;
  project_id: string;
  category: DocCategory;
  doc_type: string;
  title: string;
  content: string | null;
  metadata: Record<string, unknown> | null;
  status: DocStatus;
  created_at: string;
  updated_at: string;
};

export type DocFieldKind = "text" | "longtext" | "date" | "number";

export type DocField = {
  key: string;
  label: string;
  kind: DocFieldKind;
  required?: boolean;
  hint?: string;
};

export type DocTemplate = {
  type: string;
  category: DocCategory;
  title: string;
  description: string;
  fields: DocField[];
  /**
   * Renders the final markdown body using the user-filled fields plus
   * project context. Pure — no I/O.
   */
  render: (
    fields: Record<string, string>,
    project: { name: string | null; address: string | null },
  ) => string;
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  // Treat as a calendar date — render in en-US Mmm D, YYYY.
  const dt = new Date(`${d}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtUsd(n: string | null | undefined) {
  if (!n) return "$—";
  const v = Number(n);
  if (Number.isNaN(v)) return n;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

export const DOC_TEMPLATES: DocTemplate[] = [
  // ---------- Reports ----------
  {
    type: "daily_report",
    category: "reports",
    title: "Daily Report",
    description: "Crew, weather, work performed, materials delivered, issues.",
    fields: [
      { key: "report_date", label: "Date", kind: "date", required: true },
      { key: "weather", label: "Weather", kind: "text" },
      { key: "crew", label: "Crew on site", kind: "longtext" },
      {
        key: "work_performed",
        label: "Work performed",
        kind: "longtext",
        required: true,
      },
      { key: "materials_delivered", label: "Materials delivered", kind: "longtext" },
      { key: "issues", label: "Issues / RFIs raised", kind: "longtext" },
    ],
    render: (f, p) => `# Daily Report

**Project:** ${p.name ?? "—"}
**Address:** ${p.address ?? "—"}
**Date:** ${fmtDate(f.report_date)}
**Weather:** ${f.weather || "—"}

## Crew on site
${f.crew || "—"}

## Work performed
${f.work_performed || "—"}

## Materials delivered
${f.materials_delivered || "—"}

## Issues / RFIs raised
${f.issues || "—"}
`,
  },
  {
    type: "weekly_progress",
    category: "reports",
    title: "Weekly Progress Report",
    description: "Summary of the week — completed, in progress, upcoming.",
    fields: [
      { key: "week_ending", label: "Week ending", kind: "date", required: true },
      { key: "completed", label: "Completed this week", kind: "longtext" },
      { key: "in_progress", label: "In progress", kind: "longtext" },
      { key: "upcoming", label: "Upcoming next week", kind: "longtext" },
      { key: "blockers", label: "Blockers / concerns", kind: "longtext" },
    ],
    render: (f, p) => `# Weekly Progress Report

**Project:** ${p.name ?? "—"}
**Week ending:** ${fmtDate(f.week_ending)}

## Completed this week
${f.completed || "—"}

## In progress
${f.in_progress || "—"}

## Upcoming next week
${f.upcoming || "—"}

## Blockers / concerns
${f.blockers || "—"}
`,
  },

  // ---------- Contracts & Agreements ----------
  {
    type: "subcontractor_agreement",
    category: "contracts",
    title: "Subcontractor Agreement",
    description: "Scope of work, contract value, dates, retainage.",
    fields: [
      { key: "sub_name", label: "Subcontractor", kind: "text", required: true },
      { key: "trade", label: "Trade", kind: "text" },
      { key: "contract_value", label: "Contract value (USD)", kind: "number", required: true },
      { key: "retainage_pct", label: "Retainage %", kind: "number", hint: "e.g. 10" },
      { key: "start_date", label: "Start date", kind: "date" },
      { key: "completion_date", label: "Completion date", kind: "date" },
      { key: "scope", label: "Scope of work", kind: "longtext", required: true },
    ],
    render: (f, p) => `# Subcontractor Agreement

This agreement is between Bruno Clay Construction & Management and **${f.sub_name}**${f.trade ? ` (${f.trade})` : ""} for work on the project located at **${p.address ?? p.name ?? "—"}**.

## Contract value
${fmtUsd(f.contract_value)}${f.retainage_pct ? ` (subject to ${f.retainage_pct}% retainage)` : ""}

## Schedule
- **Start:** ${fmtDate(f.start_date) || "—"}
- **Substantial completion:** ${fmtDate(f.completion_date) || "—"}

## Scope of work
${f.scope || "—"}

## Terms
Payment per BCM standard pay-app schedule. Sub provides all labor, materials, tools, and supervision required to complete the scope. Insurance and licensure must be on file before mobilization.
`,
  },
  {
    type: "change_order",
    category: "contracts",
    title: "Change Order",
    description: "Scope or value adjustment to an existing contract.",
    fields: [
      { key: "co_number", label: "CO number", kind: "text", required: true },
      { key: "co_date", label: "CO date", kind: "date", required: true },
      { key: "affects_party", label: "Affects (Sub or Client)", kind: "text" },
      { key: "amount", label: "Amount (USD, +/-)", kind: "number" },
      { key: "description", label: "Description", kind: "longtext", required: true },
      { key: "reason", label: "Reason", kind: "longtext" },
    ],
    render: (f, p) => `# Change Order #${f.co_number}

**Project:** ${p.name ?? "—"} (${p.address ?? "—"})
**Date:** ${fmtDate(f.co_date)}
**Affects:** ${f.affects_party || "—"}

## Description of change
${f.description || "—"}

## Reason
${f.reason || "—"}

## Amount adjustment
${fmtUsd(f.amount)}
`,
  },

  // ---------- Financial ----------
  {
    type: "pay_application",
    category: "financial",
    title: "Pay Application",
    description: "Monthly payment request — schedule of values summary.",
    fields: [
      { key: "app_number", label: "Application #", kind: "text", required: true },
      { key: "period_start", label: "Period start", kind: "date" },
      { key: "period_end", label: "Period end", kind: "date", required: true },
      { key: "scheduled_value", label: "Scheduled value", kind: "number" },
      { key: "wctd", label: "Work completed to date", kind: "number" },
      { key: "retainage", label: "Retainage held", kind: "number" },
      { key: "previous", label: "Previous payments", kind: "number" },
      { key: "amount_due", label: "Amount due this period", kind: "number" },
    ],
    render: (f, p) => `# Pay Application #${f.app_number}

**Project:** ${p.name ?? "—"} (${p.address ?? "—"})
**Period:** ${fmtDate(f.period_start)} → ${fmtDate(f.period_end)}

| Line | Amount |
|---|---|
| Scheduled value | ${fmtUsd(f.scheduled_value)} |
| Work completed to date | ${fmtUsd(f.wctd)} |
| Retainage held | ${fmtUsd(f.retainage)} |
| Previous payments | ${fmtUsd(f.previous)} |
| **Amount due this period** | **${fmtUsd(f.amount_due)}** |
`,
  },
  {
    type: "invoice",
    category: "financial",
    title: "Invoice",
    description: "Standalone invoice for line items or T&M work.",
    fields: [
      { key: "invoice_number", label: "Invoice #", kind: "text", required: true },
      { key: "invoice_date", label: "Date", kind: "date", required: true },
      { key: "bill_to", label: "Bill to", kind: "text" },
      { key: "description", label: "Description / line items", kind: "longtext", required: true },
      { key: "total", label: "Total (USD)", kind: "number", required: true },
      { key: "terms", label: "Terms", kind: "text", hint: "e.g. Net 30" },
    ],
    render: (f, p) => `# Invoice #${f.invoice_number}

**Date:** ${fmtDate(f.invoice_date)}
**Bill to:** ${f.bill_to || p.name || "—"}
**Project:** ${p.name ?? "—"} (${p.address ?? "—"})

## Description
${f.description || "—"}

## Total
${fmtUsd(f.total)}

**Terms:** ${f.terms || "Net 30"}
`,
  },

  // ---------- Client Facing ----------
  {
    type: "client_proposal",
    category: "client_facing",
    title: "Client Proposal",
    description: "Pitch / quote for the project scope and value.",
    fields: [
      { key: "client_name", label: "Client name", kind: "text", required: true },
      { key: "summary", label: "Project summary", kind: "longtext", required: true },
      { key: "scope", label: "Proposed scope", kind: "longtext", required: true },
      { key: "exclusions", label: "Exclusions", kind: "longtext" },
      { key: "total", label: "Proposed total (USD)", kind: "number", required: true },
      { key: "valid_through", label: "Valid through", kind: "date" },
    ],
    render: (f, p) => `# Project Proposal

**Prepared for:** ${f.client_name}
**Project:** ${p.name ?? "—"} (${p.address ?? "—"})

## Summary
${f.summary || "—"}

## Proposed scope
${f.scope || "—"}

## Exclusions
${f.exclusions || "—"}

## Proposed total
${fmtUsd(f.total)}

${f.valid_through ? `_Valid through ${fmtDate(f.valid_through)}._` : ""}
`,
  },
  {
    type: "rfi_summary",
    category: "client_facing",
    title: "RFI Summary",
    description: "Roll-up of open RFIs for client review.",
    fields: [
      { key: "as_of", label: "As of", kind: "date", required: true },
      { key: "open_rfis", label: "Open RFIs", kind: "longtext", hint: "One per line" },
      { key: "closed_recent", label: "Closed since last summary", kind: "longtext" },
      { key: "next_steps", label: "Next steps / asks", kind: "longtext" },
    ],
    render: (f, p) => `# RFI Summary

**Project:** ${p.name ?? "—"}
**As of:** ${fmtDate(f.as_of)}

## Open RFIs
${f.open_rfis || "—"}

## Closed since last summary
${f.closed_recent || "—"}

## Next steps / asks
${f.next_steps || "—"}
`,
  },
];

export const DOC_TEMPLATES_BY_TYPE: Record<string, DocTemplate> =
  Object.fromEntries(DOC_TEMPLATES.map((t) => [t.type, t]));
