"use client";

import { useState } from "react";
import {
  FileSignature,
  HardHat,
  ListChecks,
  Mail,
  FilePlus2,
  Receipt,
  GitBranch,
  ChevronRight,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";

type DocType = {
  key: string;
  label: string;
  icon: LucideIcon;
  pulls: string;
  description: string;
};

const DOC_TYPES: DocType[] = [
  {
    key: "client_contract",
    label: "Client Contract",
    icon: FileSignature,
    pulls: "Client module",
    description:
      "Prime contract with the client. Pulls project address and contract terms from the Client module.",
  },
  {
    key: "sub_agreement",
    label: "Subcontractor Agreement",
    icon: HardHat,
    pulls: "Subs module · Bid Leveling",
    description:
      "Sub agreement covering scope and contract value. Auto-triggered from a Bid Leveling award.",
  },
  {
    key: "sow",
    label: "SOW",
    icon: ListChecks,
    pulls: "Schedule module",
    description:
      "Scope of Work for a selected sub. Pulls phases and tasks from the Schedule module.",
  },
  {
    key: "rfp",
    label: "RFP",
    icon: Mail,
    pulls: "Subs module",
    description:
      "Request for Proposal. Pulls trade and sub contact info; scope written fresh per request.",
  },
  {
    key: "client_proposal",
    label: "Client Proposal",
    icon: FilePlus2,
    pulls: "Estimating module",
    description:
      "Branded proposal for the client. Pulls from Estimating data, simple or detailed version.",
  },
  {
    key: "requisition",
    label: "Requisition",
    icon: Receipt,
    pulls: "Billing module",
    description:
      "Pay application / requisition. Pulls schedule of values from the Billing module.",
  },
  {
    key: "change_order",
    label: "Change Order",
    icon: GitBranch,
    pulls: "Contracts · Billing",
    description:
      "Change order log entry. Pulls from Contracts and Billing data.",
  },
];

export function PaperworkModule({ moduleLabel }: ModuleProps) {
  const [openDoc, setOpenDoc] = useState<DocType | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-100">{moduleLabel}</h1>
        <p className="text-sm text-zinc-500">
          Document factory. Generate, track, and send seven core construction
          documents — pre-populated from existing project data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DOC_TYPES.map((doc) => {
          const Icon = doc.icon;
          return (
            <button
              key={doc.key}
              type="button"
              onClick={() => setOpenDoc(doc)}
              className="group flex flex-col items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 transition group-hover:text-zinc-300" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-base font-medium text-zinc-100">
                  {doc.label}
                </div>
                <div className="text-xs text-zinc-500">{doc.pulls}</div>
              </div>
              <p className="text-sm text-zinc-400">{doc.description}</p>
              <div className="mt-2 inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-500">
                Coming soon
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-zinc-300">
          Company Boilerplate
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Logo, company name, years in business, mission statement, portfolio
          highlights, and standard terms — set once globally, applied across all
          generated documents.
        </p>
        <div className="mt-3 inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-500">
          Coming soon
        </div>
      </div>

      {openDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpenDoc(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
                  <openDoc.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {openDoc.label}
                  </h3>
                  <div className="text-xs text-zinc-500">{openDoc.pulls}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenDoc(null)}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-zinc-400">{openDoc.description}</p>
            <div className="mt-6 rounded-md border border-dashed border-zinc-800 bg-zinc-950/60 p-6 text-center">
              <p className="text-sm text-zinc-400">
                Document generation, PDF export, and DocuSign integration coming
                soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
