import {
  FileText,
  Package,
  HardHat,
  Users,
  ListChecks,
  Image as ImageIcon,
  DollarSign,
  BarChart3,
  Map,
  ScrollText,
  StickyNote,
  CalendarDays,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type ModuleDef = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export const modules: ModuleDef[] = [
  { key: "reports", label: "Reports", icon: FileText },
  { key: "materials", label: "Materials", icon: Package },
  { key: "subs", label: "Subs", icon: HardHat },
  { key: "team", label: "Team", icon: Users },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "budget", label: "Budget", icon: DollarSign },
  { key: "schedule", label: "Schedule", icon: BarChart3 },
  { key: "plans", label: "Plans", icon: Map },
  { key: "permits", label: "Permits", icon: ScrollText },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "client", label: "Client", icon: Building2 },
];
