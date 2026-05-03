import type { ComponentType } from "react";
import {
  BarChart3,
  FilePlus,
  Image as ImageIcon,
  Inbox,
  ListChecks,
  Map,
  Package,
  ScrollText,
  StickyNote,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ContactsModule } from "@/components/modules/contacts/ContactsModule";
import { CreateModule } from "@/components/modules/create/CreateModule";
import { MaterialsModule } from "@/components/modules/materials/MaterialsModule";
import { MessagesModule } from "@/components/modules/messages/MessagesModule";
import { NotesModule } from "@/components/modules/notes/NotesModule";
import { PermitsModule } from "@/components/modules/permits/PermitsModule";
import { PhotosModule } from "@/components/modules/photos/PhotosModule";
import { PlansModule } from "@/components/modules/plans/PlansModule";
import { ScheduleModule } from "@/components/modules/schedule/ScheduleModule";
import { SubsModule } from "@/components/modules/subs/SubsModule";
import { BudgetModule } from "@/components/modules/budget/BudgetModule";
import { WorkModule } from "@/components/modules/work/WorkModule";

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

// 12-module target spec. Order is intentional.
//   - Reports / Estimating / Paperwork / Calendar / Billing dropped from
//     the sidebar (some of their tables remain in the DB for now).
//   - "Contractors" sidebar label is now "Subs".
//   - "Tasks" key is reused for the Work module so saved localStorage
//     orderings keep working.
//   - "Create" (#12) is currently a placeholder — built out in Phase H.
export const modules: ModuleDef[] = [
  { key: "contacts",  label: "Contacts",  icon: Users,       Component: ContactsModule  },
  { key: "subs",      label: "Subs",      icon: Truck,       Component: SubsModule      },
  { key: "materials", label: "Materials", icon: Package,     Component: MaterialsModule },
  { key: "photos",    label: "Photos",    icon: ImageIcon,   Component: PhotosModule    },
  { key: "notes",     label: "Notes",     icon: StickyNote,  Component: NotesModule     },
  { key: "messages",  label: "Messages",  icon: Inbox,       Component: MessagesModule  },
  { key: "schedule",  label: "Schedule",  icon: BarChart3,   Component: ScheduleModule  },
  { key: "budget",    label: "Budget",    icon: Wallet,      Component: BudgetModule    },
  { key: "plans",     label: "Plans",     icon: Map,         Component: PlansModule     },
  { key: "permits",   label: "Permits",   icon: ScrollText,  Component: PermitsModule   },
  { key: "tasks",     label: "Work",      icon: ListChecks,  Component: WorkModule      },
  { key: "create",    label: "Create",    icon: FilePlus,    Component: CreateModule    },
];
