import { supabase } from "@/lib/supabase";

export type ContractorMaterial = {
  id: string;
  product_name: string;
  manufacturer: string | null;
  supplier: string | null;
  status: string | null;
  qty: number | null;
  price: number | null;
};

export type ContractorScheduleTask = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  phase_name: string | null;
};

export type ContractorPlanLink = {
  drawing_id: string | null;
  drawing_number: string | null;
  drawing_title: string | null;
  extraction_id: string | null;
  extraction_label: string | null;
  extraction_description: string | null;
  extraction_category: string | null;
};

export type ContractorJob = {
  id: string;
  title: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  scope: string | null;
};

export type ContractorMessage = {
  id: string;
  source: "message" | "note";
  ts: string;
  subject: string;
  preview: string;
  entry_type?: string;
  priority?: string;
};

export type ContractorDocument = {
  id: string;
  source: "drawing";
  label: string;
  detail: string;
  url: string | null;
  date: string | null;
};

export type ContractorDetail = {
  source_extraction_id: string | null;
  source_drawing_id: string | null;
  materials: ContractorMaterial[];
  schedule_tasks: ContractorScheduleTask[];
  jobs: ContractorJob[];
  plan_link: ContractorPlanLink | null;
  communications: ContractorMessage[];
  documents: ContractorDocument[];
};

export async function fetchContractorDetail(
  projectId: string,
  subId: string,
): Promise<ContractorDetail> {
  // 1. Fetch the sub row to get source pointers + email for filtering.
  const subRes = await supabase
    .from("subs")
    .select("contact_email, name, source_extraction_id, source_drawing_id")
    .eq("id", subId)
    .maybeSingle();
  if (subRes.error) throw subRes.error;
  const source_extraction_id =
    (subRes.data?.source_extraction_id as string | null) ?? null;
  const source_drawing_id =
    (subRes.data?.source_drawing_id as string | null) ?? null;
  const subEmail = (subRes.data?.contact_email as string | null) ?? null;
  const subName = (subRes.data?.name as string | null) ?? null;

  // 2. Materials (project-scoped, assigned to this sub).
  const materialsRes = await supabase
    .from("materials")
    .select("id, product_name, manufacturer, supplier, status, qty, price")
    .eq("project_id", projectId)
    .eq("assigned_sub_id", subId)
    .order("product_name", { ascending: true });
  if (materialsRes.error) throw materialsRes.error;

  // 3. Schedule tasks via project_subs link.
  const linkRes = await supabase
    .from("project_subs")
    .select("id")
    .eq("project_id", projectId)
    .eq("sub_id", subId)
    .maybeSingle();
  if (linkRes.error) throw linkRes.error;
  let schedule_tasks: ContractorScheduleTask[] = [];
  if (linkRes.data?.id) {
    const tasksRes = await supabase
      .from("schedule_tasks")
      .select(
        "id, name, status, start_date, end_date, phase_id, schedule_phases(name)",
      )
      .eq("assigned_sub_id", linkRes.data.id);
    if (tasksRes.error) throw tasksRes.error;
    schedule_tasks = (tasksRes.data ?? []).map((t) => {
      const phaseField = (t as { schedule_phases?: unknown }).schedule_phases;
      let phaseName: string | null = null;
      if (Array.isArray(phaseField) && phaseField.length > 0) {
        const first = phaseField[0] as { name?: string | null };
        phaseName = first?.name ?? null;
      } else if (phaseField && typeof phaseField === "object") {
        phaseName = (phaseField as { name?: string | null }).name ?? null;
      }
      return {
        id: t.id as string,
        name: t.name as string,
        status: t.status as string,
        start_date: (t.start_date as string | null) ?? null,
        end_date: (t.end_date as string | null) ?? null,
        phase_name: phaseName,
      };
    });
  }

  // 7. Jobs assigned to this contractor on this project.
  const jobsRes = await supabase
    .from("jobs")
    .select("id, title, status, start_date, end_date, scope")
    .eq("project_id", projectId)
    .eq("sub_id", subId)
    .order("created_at", { ascending: false });
  if (jobsRes.error) throw jobsRes.error;
  const jobs = (jobsRes.data ?? []) as ContractorJob[];

  // 8. Plan link via source extraction / drawing recorded on the sub row.
  let plan_link: ContractorPlanLink | null = null;
  if (source_extraction_id || source_drawing_id) {
    plan_link = {
      drawing_id: source_drawing_id,
      drawing_number: null,
      drawing_title: null,
      extraction_id: source_extraction_id,
      extraction_label: null,
      extraction_description: null,
      extraction_category: null,
    };
    if (source_drawing_id) {
      const dRes = await supabase
        .from("drawings")
        .select("drawing_number, title")
        .eq("id", source_drawing_id)
        .maybeSingle();
      if (!dRes.error && dRes.data) {
        plan_link.drawing_number = dRes.data.drawing_number ?? null;
        plan_link.drawing_title = dRes.data.title ?? null;
      }
    }
    // drawing_extractions table was retired when the new bcm-plans-permits
    // tool took over the Plans schema. The label/description/category
    // fields stay null here; the source_drawing_id lookup above still
    // works since `drawings` is preserved.
  }

  // 9. Communications: messages from the sub's email + scratch_notes
  // tagged to this sub_id via tagged_module/tagged_record_id.
  const communications: ContractorMessage[] = [];
  if (subEmail) {
    const msgRes = await supabase
      .from("messages")
      .select("id, subject, body, received_at, entry_type, priority")
      .eq("project_id", projectId)
      .ilike("from_email", subEmail)
      .order("received_at", { ascending: false })
      .limit(50);
    if (!msgRes.error) {
      for (const m of msgRes.data ?? []) {
        communications.push({
          id: m.id as string,
          source: "message",
          ts: (m.received_at as string) ?? "",
          subject: (m.subject as string | null) ?? "(no subject)",
          preview: ((m.body as string | null) ?? "").slice(0, 200),
          entry_type: (m.entry_type as string | null) ?? undefined,
          priority: (m.priority as string | null) ?? undefined,
        });
      }
    }
  }
  const noteRes = await supabase
    .from("scratch_notes")
    .select("id, content, created_at, note_type")
    .eq("project_id", projectId)
    .eq("tagged_module", "subs")
    .eq("tagged_record_id", subId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!noteRes.error) {
    for (const n of noteRes.data ?? []) {
      communications.push({
        id: n.id as string,
        source: "note",
        ts: (n.created_at as string) ?? "",
        subject:
          (n.note_type as string | null)?.replace(/_/g, " ") ?? "Note",
        preview: ((n.content as string | null) ?? "").slice(0, 200),
      });
    }
  }
  communications.sort((a, b) => (a.ts < b.ts ? 1 : -1));

  // 10. Documents: plans uploads tied to sub by upload_verified_by name.
  const documents: ContractorDocument[] = [];
  if (subName) {
    // Drawings uploaded by anyone with the sub's name in upload_verified_by.
    const drawRes = await supabase
      .from("drawings")
      .select("id, drawing_number, title, pdf_url, upload_verified_date, created_at")
      .eq("project_id", projectId)
      .ilike("upload_verified_by", subName)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!drawRes.error) {
      for (const d of drawRes.data ?? []) {
        documents.push({
          id: `dwg-${d.id}`,
          source: "drawing",
          label: `${d.drawing_number ?? ""} ${d.title ?? "Drawing"}`.trim(),
          detail: "Plans upload",
          url: (d.pdf_url as string | null) ?? null,
          date:
            (d.upload_verified_date as string | null) ??
            (d.created_at as string | null) ??
            null,
        });
      }
    }
  }
  documents.sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1));

  return {
    source_extraction_id,
    source_drawing_id,
    materials: (materialsRes.data ?? []) as ContractorMaterial[],
    schedule_tasks,
    jobs,
    plan_link,
    communications,
    documents,
  };
}

export function fmtDate(s: string | null): string {
  if (!s) return "—";
  return s.slice(0, 10);
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
