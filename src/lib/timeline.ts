import { supabase } from "@/lib/supabase";

// Timeline events — fire-and-forget audit log writer for the Calendar →
// Timeline tab. Designed so callers never have to await or care about
// failures: a missed timeline row should never block the user's actual
// action (status change, photo upload, line-item edit, etc).

export type TimelineModule = "schedule" | "budget" | "photos";

export type WriteTimelineEventArgs = {
  projectId: string;
  moduleKey: TimelineModule;
  eventType: string;
  title: string;
  details?: Record<string, unknown>;
  refTable?: string;
  refId?: string | null;
  actor?: string | null;
};

export function writeTimelineEvent(args: WriteTimelineEventArgs): void {
  // Intentionally not awaited — callers don't want timeline writes to
  // be on the critical path. Errors land in the console but don't
  // surface to the user.
  void supabase
    .from("timeline_events")
    .insert({
      project_id: args.projectId,
      module_key: args.moduleKey,
      event_type: args.eventType,
      title: args.title,
      details: args.details ?? {},
      ref_table: args.refTable ?? null,
      ref_id: args.refId ?? null,
      actor: args.actor ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[timeline] write failed", error);
      }
    });
}
