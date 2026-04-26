"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileText,
  Flag,
  Landmark,
  PackageCheck,
  ScrollText,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import { canEdit, useRole } from "@/lib/role-context";

type Group = "Daily" | "Weekly" | "Financial" | "Client Facing" | "Compliance" | "Close Out";

type ReportDef = {
  id: string;
  name: string;
  description: string;
  group: Group;
  icon: LucideIcon;
  previewSections: string[];
};

const REPORTS: ReportDef[] = [
  {
    id: "daily",
    name: "Daily Report",
    description:
      "Snapshot of job activity for the day: tasks, inspections, photos, and site attendance.",
    group: "Daily",
    icon: CalendarCheck,
    previewSections: [
      "Site Attendance",
      "Tasks Completed Today",
      "Inspections Today",
      "Site Photos",
      "Notes & Issues",
    ],
  },
  {
    id: "weekly_progress",
    name: "Weekly Progress Report",
    description:
      "Schedule status, completed tasks, budget vs actual, open RFIs, pending items, and upcoming inspections.",
    group: "Weekly",
    icon: TrendingUp,
    previewSections: [
      "Schedule Status",
      "Completed Tasks",
      "Budget vs Actual",
      "Open RFIs",
      "Pending Items",
      "Upcoming Inspections",
    ],
  },
  {
    id: "job_cost",
    name: "Job Cost Report",
    description:
      "Budget vs actual by line item with variance and projected final cost.",
    group: "Financial",
    icon: BarChart3,
    previewSections: [
      "Cost Codes Summary",
      "Budget vs Actual by Line Item",
      "Variance Analysis",
      "Projected Final Cost",
    ],
  },
  {
    id: "cash_flow",
    name: "Cash Flow Report",
    description: "Billed vs paid vs outstanding with retainage summary.",
    group: "Financial",
    icon: Wallet,
    previewSections: [
      "Billed to Date",
      "Paid to Date",
      "Outstanding Receivables",
      "Retainage Summary",
      "Cash Flow Curve",
    ],
  },
  {
    id: "sub_payment_summary",
    name: "Sub Payment Summary",
    description:
      "Payment status and remaining balance per subcontractor.",
    group: "Financial",
    icon: DollarSign,
    previewSections: [
      "Subcontractor List",
      "Contract Value",
      "Billed / Paid / Retainage",
      "Remaining Balance",
      "Payment Status",
    ],
  },
  {
    id: "owner_report",
    name: "Owner Report",
    description:
      "Polished, non-technical summary of progress, milestones, budget health, and photos for the client.",
    group: "Client Facing",
    icon: Sparkles,
    previewSections: [
      "Executive Summary",
      "Schedule Progress",
      "Milestone Status",
      "Budget Health",
      "Recent Site Photos",
      "Looking Ahead",
    ],
  },
  {
    id: "milestone_report",
    name: "Milestone Report",
    description:
      "Schedule milestone view as a shareable PDF for the client.",
    group: "Client Facing",
    icon: Flag,
    previewSections: [
      "Project Timeline",
      "Major Milestones",
      "Completed Milestones",
      "Upcoming Milestones",
    ],
  },
  {
    id: "meeting_minutes",
    name: "Meeting Minutes",
    description:
      "Formal published record of a meeting — attendees, notes summary, action items, and decisions, ready to distribute.",
    group: "Client Facing",
    icon: ClipboardList,
    previewSections: [
      "Meeting Header (name · date · location)",
      "Attendees",
      "Agenda / Topics",
      "Notes Summary",
      "Decisions",
      "Action Items",
      "Next Meeting",
    ],
  },
  {
    id: "permit_status",
    name: "Permit Status Report",
    description:
      "All permits, current status, upcoming expirations, and failed inspections.",
    group: "Compliance",
    icon: ScrollText,
    previewSections: [
      "Master Permit",
      "Sub-Permits & Status",
      "Upcoming Expirations",
      "Failed Inspections",
    ],
  },
  {
    id: "inspection_log",
    name: "Inspection Log",
    description:
      "Full history of all inspections and results across all permits.",
    group: "Compliance",
    icon: ClipboardCheck,
    previewSections: [
      "Inspections by Permit",
      "Pass / Fail / Reinspection",
      "Inspector Notes",
      "Correction Notices",
    ],
  },
  {
    id: "close_out",
    name: "Close Out Report",
    description:
      "Final cost summary, punch list status, CO status, executed contracts, and warranty information.",
    group: "Close Out",
    icon: PackageCheck,
    previewSections: [
      "Final Cost Summary",
      "Punch List Status",
      "Certificate of Occupancy",
      "Executed Contracts",
      "Warranty Information",
      "Lien Releases",
    ],
  },
];

const GROUP_ORDER: Group[] = [
  "Daily",
  "Weekly",
  "Financial",
  "Client Facing",
  "Compliance",
  "Close Out",
];

const GROUP_ICON: Record<Group, LucideIcon> = {
  Daily: Clock,
  Weekly: TrendingUp,
  Financial: Landmark,
  "Client Facing": Sparkles,
  Compliance: ScrollText,
  "Close Out": PackageCheck,
};

export function ReportsModule({ moduleLabel }: ModuleProps) {
  const role = useRole();
  const allowed = role !== "super";
  const interactive = canEdit(role);

  const [previewing, setPreviewing] = useState<ReportDef | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  if (!allowed) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-zinc-100">{moduleLabel}</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Reports are not available for the Super role on desktop.
        </p>
      </div>
    );
  }

  function handleGenerate(report: ReportDef) {
    setToast(`Report generation coming soon — ${report.name}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">{moduleLabel}</h1>
      </div>

      <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-3 text-xs">
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-300">
          Placeholder
        </span>
        <span className="ml-2 text-zinc-400">
          UI only. Live data wiring lands once all source modules are
          complete.
        </span>
      </div>

      <div className="flex flex-col gap-8">
        {GROUP_ORDER.map((group) => {
          const items = REPORTS.filter((r) => r.group === group);
          if (items.length === 0) return null;
          const GroupIcon = GROUP_ICON[group];
          return (
            <section key={group} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <GroupIcon className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
                  {group}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    interactive={interactive}
                    onGenerate={() => handleGenerate(r)}
                    onPreview={() => setPreviewing(r)}
                    isPreviewing={previewing?.id === r.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {previewing && (
        <PreviewPanel
          report={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
  interactive,
  onGenerate,
  onPreview,
  isPreviewing,
}: {
  report: ReportDef;
  interactive: boolean;
  onGenerate: () => void;
  onPreview: () => void;
  isPreviewing: boolean;
}) {
  const Icon = report.icon;
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-zinc-900/60 p-4 transition ${
        isPreviewing
          ? "border-blue-500/40 bg-zinc-900"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-zinc-100">{report.name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {report.description}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!interactive}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          Generate PDF
        </button>
        <button
          type="button"
          onClick={onPreview}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition ${
            isPreviewing
              ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>
    </div>
  );
}

function PreviewPanel({
  report,
  onClose,
}: {
  report: ReportDef;
  onClose: () => void;
}) {
  const Icon = report.icon;
  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                {report.name}
              </h3>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                Preview · {report.group}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="text-sm text-zinc-400">{report.description}</p>

          <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-3 text-xs text-zinc-500">
            Wireframe preview. Section structure shown — live data wiring
            ships in a follow-up sprint.
          </div>

          {/* Wireframe header bar — title + project meta */}
          <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900 p-4">
            <div className="h-5 w-2/3 rounded bg-zinc-800" />
            <div className="flex gap-2">
              <div className="h-3 w-24 rounded bg-zinc-800" />
              <div className="h-3 w-32 rounded bg-zinc-800" />
              <div className="h-3 w-20 rounded bg-zinc-800" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {report.previewSections.map((section, idx) => (
              <PreviewSection key={section} index={idx} title={section} />
            ))}
          </div>

          {/* Wireframe footer — signature block / footer */}
          <div className="mt-2 flex items-center gap-3 border-t border-zinc-800 pt-3">
            <div className="h-8 w-32 rounded border border-dashed border-zinc-700" />
            <div className="ml-auto flex flex-col gap-1">
              <div className="h-2 w-24 rounded bg-zinc-800" />
              <div className="h-2 w-32 rounded bg-zinc-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({
  index,
  title,
}: {
  index: number;
  title: string;
}) {
  // Alternate layout flavors so the preview feels distinct per section
  const variant = index % 3;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          {title}
        </h4>
        <span className="text-[10px] text-zinc-600">section {index + 1}</span>
      </div>
      <div className="mt-3">
        {variant === 0 && (
          <div className="flex flex-col gap-2">
            {[80, 65, 90, 55].map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-zinc-700" />
                <div
                  className="h-2.5 rounded bg-zinc-800"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
        )}
        {variant === 1 && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded border border-zinc-800 bg-zinc-950/50 p-2"
              >
                <div className="h-3 w-12 rounded bg-zinc-800" />
                <div className="mt-2 h-5 w-16 rounded bg-zinc-700" />
              </div>
            ))}
          </div>
        )}
        {variant === 2 && (
          <div className="overflow-hidden rounded border border-zinc-800">
            <div className="grid grid-cols-4 gap-px bg-zinc-800">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 bg-zinc-950 px-2 py-1"
                >
                  <div className="h-2 w-3/4 rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
