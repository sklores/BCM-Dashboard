"use client";

import { useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import type { ModuleProps } from "@/components/dashboard/modules";
import { CalendarView } from "./CalendarView";
import { FeedView } from "./FeedView";

type Tab = "calendar" | "feed";

export function CalendarModule(props: ModuleProps) {
  const [tab, setTab] = useState<Tab>("calendar");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Calendar</h1>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800">
        <TabBtn
          active={tab === "calendar"}
          onClick={() => setTab("calendar")}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="Calendar"
        />
        <TabBtn
          active={tab === "feed"}
          onClick={() => setTab("feed")}
          icon={<Bell className="h-3.5 w-3.5" />}
          label="Feed"
        />
      </div>

      {tab === "calendar" && <CalendarView {...props} />}
      {tab === "feed" && <FeedView {...props} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs ${
        active
          ? "border-blue-500 text-blue-300"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
