import type { ComponentType } from "react";
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
  Inbox,
  Calculator,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import { ScheduleModule } from "@/components/modules/schedule/ScheduleModule";
import { SubsModule } from "@/components/modules/subs/SubsModule";
import { TeamModule } from "@/components/modules/team/TeamModule";
import { MaterialsModule } from "@/components/modules/materials/MaterialsModule";
import { MessagesModule } from "@/components/modules/messages/MessagesModule";
import { PhotosModule } from "@/components/modules/photos/PhotosModule";
import { TasksModule } from "@/components/modules/tasks/TasksModule";
import { EstimatingModule } from "@/components/modules/estimating/EstimatingModule";
import { ContractsModule } from "@/components/modules/contracts/ContractsModule";
import { ProposalsModule } from "@/components/modules/proposals/ProposalsModule";
import { PlansModule } from "@/components/modules/plans/PlansModule";
import { PlaceholderModule } from "@/components/modules/placeholder/PlaceholderModule";

export type ModuleProps = {
  projectId: string;
  moduleKey: string;
  moduleLabel: string;
};

export type ModuleDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType<ModuleProps>;
};

export const modules: ModuleDef[] = [
  { key: "reports",   label: "Reports",   icon: FileText,     Component: PlaceholderModule },
  { key: "materials", label: "Materials", icon: Package,      Component: MaterialsModule  },
  { key: "subs",      label: "Subs",      icon: HardHat,      Component: SubsModule       },
  { key: "team",      label: "Team",      icon: Users,        Component: TeamModule       },
  { key: "tasks",     label: "Tasks",     icon: ListChecks,   Component: TasksModule       },
  { key: "photos",    label: "Photos",    icon: ImageIcon,    Component: PhotosModule      },
  { key: "budget",    label: "Budget",    icon: DollarSign,   Component: PlaceholderModule },
  { key: "schedule",  label: "Schedule",  icon: BarChart3,    Component: ScheduleModule    },
  { key: "plans",     label: "Plans",     icon: Map,          Component: PlansModule       },
  { key: "permits",   label: "Permits",   icon: ScrollText,   Component: PlaceholderModule },
  { key: "notes",     label: "Notes",     icon: StickyNote,   Component: PlaceholderModule },
  { key: "messages",  label: "Messages",  icon: Inbox,        Component: MessagesModule    },
  { key: "calendar",  label: "Calendar",  icon: CalendarDays, Component: PlaceholderModule },
  { key: "client",       label: "Client",          icon: Building2,      Component: PlaceholderModule       },
  { key: "estimating",   label: "Estimating",      icon: Calculator,     Component: EstimatingModule        },
  { key: "contracts",    label: "Contracts",       icon: FileSignature,  Component: ContractsModule         },
  { key: "proposals",    label: "Proposals",       icon: FileText,       Component: ProposalsModule         },
];
