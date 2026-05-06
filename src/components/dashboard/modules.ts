import type { ComponentType } from "react";
import {
  BarChart3,
  CalendarDays,
  Image as ImageIcon,
  Inbox,
  ListChecks,
  Package,
  StickyNote,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { CalendarModule } from "@/components/modules/calendar/CalendarModule";
import { ContactsModule } from "@/components/modules/contacts/ContactsModule";
import { MaterialsModule } from "@/components/modules/materials/MaterialsModule";
import { MessagesModule } from "@/components/modules/messages/MessagesModule";
import { NotesModule } from "@/components/modules/notes/NotesModule";
import { PhotosModule } from "@/components/modules/photos/PhotosModule";
import { ScheduleModule } from "@/components/modules/schedule/ScheduleModule";
import { SubsModule } from "@/components/modules/subs/SubsModule";
import { BudgetModule } from "@/components/modules/budget/BudgetModule";
import { WorkModule } from "@/components/modules/work/WorkModule";

// MVP-hidden modules — implementations stay in the repo for re-enable
// later. To restore, uncomment the import and the entry in `modules`
// below. Plans, Permits, and Create are full features; Calendar
// replaced their slot in the sidebar for the MVP.
// import { PlansModule } from "@/components/modules/plans/PlansModule";
// import { PermitsModule } from "@/components/modules/permits/PermitsModule";
// import { CreateModule } from "@/components/modules/create/CreateModule";
// (Map, ScrollText, FilePlus icons unused while those modules are hidden.)

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

// MVP sidebar. Plans / Permits / Create are temporarily hidden — their
// implementations stay in src/ for re-enable later. Calendar slots in
// (with a Feed tab for the activity-bus / alerts table).
export const modules: ModuleDef[] = [
  { key: "contacts",  label: "Contacts",  icon: Users,       Component: ContactsModule  },
  { key: "subs",      label: "Subs",      icon: Truck,       Component: SubsModule      },
  { key: "materials", label: "Materials", icon: Package,     Component: MaterialsModule },
  { key: "photos",    label: "Photos",    icon: ImageIcon,   Component: PhotosModule    },
  { key: "notes",     label: "Notes",     icon: StickyNote,  Component: NotesModule     },
  { key: "messages",  label: "Messages",  icon: Inbox,       Component: MessagesModule  },
  { key: "schedule",  label: "Schedule",  icon: BarChart3,   Component: ScheduleModule  },
  { key: "budget",    label: "Budget",    icon: Wallet,      Component: BudgetModule    },
  { key: "calendar",  label: "Calendar",  icon: CalendarDays, Component: CalendarModule },
  { key: "tasks",     label: "Work",      icon: ListChecks,  Component: WorkModule      },
];
