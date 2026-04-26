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
  Inbox,
  Calculator,
  FileSignature,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ScheduleModule } from "@/components/modules/schedule/ScheduleModule";
import { SubsModule } from "@/components/modules/subs/SubsModule";
import { ContactsModule } from "@/components/modules/contacts/ContactsModule";
import { PermitsModule } from "@/components/modules/permits/PermitsModule";
import { MaterialsModule } from "@/components/modules/materials/MaterialsModule";
import { MessagesModule } from "@/components/modules/messages/MessagesModule";
import { PhotosModule } from "@/components/modules/photos/PhotosModule";
import { TasksModule } from "@/components/modules/tasks/TasksModule";
import { EstimatingModule } from "@/components/modules/estimating/EstimatingModule";
import { PlansModule } from "@/components/modules/plans/PlansModule";
import { BillingModule } from "@/components/modules/billing/BillingModule";
import { PaperworkModule } from "@/components/modules/paperwork/PaperworkModule";
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
  { key: "reports",    label: "Reports",    icon: FileText,      Component: PlaceholderModule },
  { key: "estimating", label: "Estimating", icon: Calculator,    Component: EstimatingModule  },
  { key: "paperwork",  label: "Paperwork",  icon: FileSignature, Component: PaperworkModule   },
  { key: "materials",  label: "Materials",  icon: Package,       Component: MaterialsModule   },
  { key: "subs",       label: "Subs",       icon: HardHat,       Component: SubsModule        },
  { key: "contacts",   label: "Contacts",   icon: Users,         Component: ContactsModule    },
  { key: "tasks",      label: "Tasks",      icon: ListChecks,    Component: TasksModule       },
  { key: "photos",     label: "Photos",     icon: ImageIcon,     Component: PhotosModule      },
  { key: "budget",     label: "Budget",     icon: Wallet,        Component: PlaceholderModule },
  { key: "schedule",   label: "Schedule",   icon: BarChart3,     Component: ScheduleModule    },
  { key: "plans",      label: "Plans",      icon: Map,           Component: PlansModule       },
  { key: "permits",    label: "Permits",    icon: ScrollText,    Component: PermitsModule     },
  { key: "notes",      label: "Notes",      icon: StickyNote,    Component: PlaceholderModule },
  { key: "calendar",   label: "Calendar",   icon: CalendarDays,  Component: PlaceholderModule },
  { key: "messages",   label: "Messages",   icon: Inbox,         Component: MessagesModule    },
  { key: "billing",    label: "Billing",    icon: DollarSign,    Component: BillingModule     },
];
