"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import {
  fetchContractorDetail,
  fmtDate,
  fmtUsd,
  type ContractorDetail,
} from "./detail-queries";
import type { Sub } from "./types";

type Tab =
  | "overview"
  | "jobs"
  | "materials"
  | "paperwork"
  | "billing"
  | "schedule"
  | "plans";

const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["jobs", "Jobs"],
  ["materials", "Materials"],
  ["paperwork", "Paperwork"],
  ["billing", "Billing"],
  ["schedule", "Schedule"],
  ["plans", "Plans"],
];

export function ContractorDetailPage({
  projectId,
  sub,
  onBack,
}: {
  projectId: string;
  sub: Sub;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<ContractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await fetchContractorDetail(projectId, sub.id);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sub.id]);

  const counts: Record<Tab, number | null> = {
    overview: null,
    jobs: detail?.jobs.length ?? null,
    materials: detail?.materials.length ?? null,
    paperwork:
      (detail?.agreements.length ?? 0) + (detail?.change_orders.length ?? 0) ||
      null,
    billing: detail?.requisitions.length ?? null,
    schedule: detail?.schedule_tasks.length ?? null,
    plans: detail?.plan_link ? 1 : null,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Contractors
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-zinc-100">
            {sub.name || "Untitled contractor"}
          </h1>
          <p className="truncate text-xs text-zinc-500">
            {sub.trade ? sub.trade : "No trade"}
            {sub.contact_name ? ` · ${sub.contact_name}` : ""}
            {sub.contact_email ? ` · ${sub.contact_email}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800">
        {TABS.map(([key, label]) => {
          const active = tab === key;
          const count = counts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${
                active
                  ? "border-blue-500 text-blue-300"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
              {count !== null && count > 0 && (
                <span className="ml-1.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && detail && (
        <>
          {tab === "overview" && <OverviewTab sub={sub} detail={detail} />}
          {tab === "jobs" && <JobsTab detail={detail} />}
          {tab === "materials" && <MaterialsTab detail={detail} />}
          {tab === "paperwork" && <PaperworkTab detail={detail} />}
          {tab === "billing" && <BillingTab detail={detail} />}
          {tab === "schedule" && <ScheduleTab detail={detail} />}
          {tab === "plans" && <PlansTab detail={detail} />}
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
      {msg}
    </div>
  );
}

function OverviewTab({
  sub,
  detail,
}: {
  sub: Sub;
  detail: ContractorDetail;
}) {
  const totalContract = detail.agreements.reduce(
    (s, a) => s + (Number(a.contract_value) || 0),
    0,
  );
  const totalCo = detail.change_orders.reduce(
    (s, c) => s + (Number(c.amount) || 0),
    0,
  );
  const totalBilled = detail.requisitions.reduce(
    (s, r) => s + (Number(r.work_completed_to_date) || 0),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card label="Contract value" value={fmtUsd(totalContract)} />
        <Card label="Change orders" value={fmtUsd(totalCo)} />
        <Card label="Billed to date" value={fmtUsd(totalBilled)} />
        <Card label="Schedule tasks" value={detail.schedule_tasks.length} />
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
          Contact
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Trade</dt>
            <dd className="text-zinc-200">{sub.trade ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">License</dt>
            <dd className="text-zinc-200">{sub.license_number ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Contact name</dt>
            <dd className="text-zinc-200">{sub.contact_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{sub.contact_email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Phone</dt>
            <dd className="text-zinc-200">{sub.contact_phone ?? "—"}</dd>
          </div>
        </dl>
        {sub.notes && (
          <p className="mt-3 whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300">
            {sub.notes}
          </p>
        )}
      </div>

      {detail.plan_link && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
          <p className="text-[10px] uppercase tracking-wider text-blue-300">
            Created from a plan extraction
          </p>
          <p className="mt-1 text-zinc-200">
            {detail.plan_link.extraction_label ?? "—"}
          </p>
          {detail.plan_link.extraction_description && (
            <p className="mt-0.5 text-xs text-zinc-400">
              {detail.plan_link.extraction_description}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            {detail.plan_link.drawing_number ??
              detail.plan_link.drawing_title ??
              "Drawing"}
          </p>
        </div>
      )}
    </div>
  );
}

function JobsTab({ detail }: { detail: ContractorDetail }) {
  if (detail.jobs.length === 0)
    return (
      <Empty msg="No jobs assigned to this contractor. Create a job from the Work module to bundle their scope, materials, and drawings." />
    );
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">End</th>
            <th className="px-3 py-2 font-medium">Scope</th>
          </tr>
        </thead>
        <tbody>
          {detail.jobs.map((j) => (
            <tr key={j.id} className="border-b border-zinc-900">
              <td className="px-3 py-2 text-zinc-200">{j.title ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-300">{j.status}</td>
              <td className="px-3 py-2 text-zinc-300">{fmtDate(j.start_date)}</td>
              <td className="px-3 py-2 text-zinc-300">{fmtDate(j.end_date)}</td>
              <td className="px-3 py-2 text-zinc-300">
                <span className="line-clamp-2">{j.scope ?? "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialsTab({ detail }: { detail: ContractorDetail }) {
  if (detail.materials.length === 0)
    return (
      <Empty msg="No materials assigned. Tag a material to this contractor from the Materials module." />
    );
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Manufacturer</th>
            <th className="px-3 py-2 font-medium">Supplier</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Qty</th>
            <th className="px-3 py-2 font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {detail.materials.map((m) => (
            <tr key={m.id} className="border-b border-zinc-900">
              <td className="px-3 py-2 text-zinc-200">{m.product_name}</td>
              <td className="px-3 py-2 text-zinc-300">{m.manufacturer ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-300">{m.supplier ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-300">{m.status ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-300">{m.qty ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-300">{fmtUsd(m.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaperworkTab({ detail }: { detail: ContractorDetail }) {
  if (
    detail.agreements.length === 0 &&
    detail.change_orders.length === 0
  )
    return (
      <Empty msg="No agreements or change orders. Generate a Subcontractor Agreement from Paperwork to get started." />
    );

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500">
          Subcontractor agreements
        </h3>
        {detail.agreements.length === 0 ? (
          <p className="text-sm text-zinc-500">No agreements.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">Contract #</th>
                  <th className="px-3 py-2 font-medium">Trade</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium">Completion</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {detail.agreements.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-900">
                    <td className="px-3 py-2 text-zinc-200">
                      {a.contract_number ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {a.trade ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {fmtUsd(a.contract_value)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {fmtDate(a.start_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {fmtDate(a.completion_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{a.status}</td>
                    <td className="px-3 py-2 text-zinc-300">
                      {a.pdf_url ? (
                        <a
                          href={a.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500">
          Change orders
        </h3>
        {detail.change_orders.length === 0 ? (
          <p className="text-sm text-zinc-500">No change orders.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2 font-medium">CO #</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.change_orders.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-900">
                    <td className="px-3 py-2 text-zinc-200">
                      {c.co_number ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {fmtDate(c.co_date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {c.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {fmtUsd(c.amount)}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BillingTab({ detail }: { detail: ContractorDetail }) {
  if (detail.requisitions.length === 0)
    return (
      <Empty msg="No sub requisitions yet. Requisitions are entered from the Billing module." />
    );
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Period</th>
            <th className="px-3 py-2 font-medium">Scheduled</th>
            <th className="px-3 py-2 font-medium">WCTD</th>
            <th className="px-3 py-2 font-medium">Amount due</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {detail.requisitions.map((r) => (
            <tr key={r.id} className="border-b border-zinc-900">
              <td className="px-3 py-2 text-zinc-200">
                {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
              </td>
              <td className="px-3 py-2 text-zinc-300">
                {fmtUsd(r.scheduled_value)}
              </td>
              <td className="px-3 py-2 text-zinc-300">
                {fmtUsd(r.work_completed_to_date)}
              </td>
              <td className="px-3 py-2 text-zinc-300">
                {fmtUsd(r.amount_due)}
              </td>
              <td className="px-3 py-2 text-zinc-300">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleTab({ detail }: { detail: ContractorDetail }) {
  if (detail.schedule_tasks.length === 0)
    return (
      <Empty msg="No schedule tasks assigned. Assign tasks to this contractor from the Schedule module." />
    );
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-medium">Phase</th>
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Start</th>
            <th className="px-3 py-2 font-medium">End</th>
          </tr>
        </thead>
        <tbody>
          {detail.schedule_tasks.map((t) => (
            <tr key={t.id} className="border-b border-zinc-900">
              <td className="px-3 py-2 text-zinc-300">{t.phase_name ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-200">{t.name}</td>
              <td className="px-3 py-2 text-zinc-300">{t.status}</td>
              <td className="px-3 py-2 text-zinc-300">{fmtDate(t.start_date)}</td>
              <td className="px-3 py-2 text-zinc-300">{fmtDate(t.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlansTab({ detail }: { detail: ContractorDetail }) {
  if (!detail.plan_link)
    return (
      <Empty msg="This contractor wasn't created from a plan extraction. Push an extracted item to Contractors from the Plans module to link it." />
    );
  const link = detail.plan_link;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
          Source drawing
        </p>
        <p className="mt-1 text-sm text-zinc-100">
          {link.drawing_number ?? "—"}
          {link.drawing_title ? ` · ${link.drawing_title}` : ""}
        </p>
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
          Source extraction
        </p>
        <p className="mt-1 text-sm text-zinc-100">
          {link.extraction_label ?? "—"}
        </p>
        {link.extraction_category && (
          <p className="mt-0.5 text-xs text-zinc-500">
            {link.extraction_category}
          </p>
        )}
        {link.extraction_description && (
          <p className="mt-2 text-xs text-zinc-400">
            {link.extraction_description}
          </p>
        )}
      </div>
    </div>
  );
}
