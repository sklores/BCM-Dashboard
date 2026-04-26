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

export type ContractorAgreement = {
  id: string;
  contract_number: string | null;
  trade: string | null;
  contract_value: number | null;
  start_date: string | null;
  completion_date: string | null;
  status: string;
  pdf_url: string | null;
};

export type ContractorChangeOrder = {
  id: string;
  co_number: number | null;
  co_date: string | null;
  description: string | null;
  amount: number | null;
  status: string;
};

export type ContractorRequisition = {
  id: string;
  period_start: string | null;
  period_end: string | null;
  scheduled_value: number | null;
  work_completed_to_date: number | null;
  amount_due: number | null;
  status: string;
  created_at: string;
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

export type ContractorDetail = {
  source_extraction_id: string | null;
  source_drawing_id: string | null;
  materials: ContractorMaterial[];
  agreements: ContractorAgreement[];
  change_orders: ContractorChangeOrder[];
  requisitions: ContractorRequisition[];
  schedule_tasks: ContractorScheduleTask[];
  jobs: ContractorJob[];
  plan_link: ContractorPlanLink | null;
};

export async function fetchContractorDetail(
  projectId: string,
  subId: string,
): Promise<ContractorDetail> {
  // 1. Fetch the sub row to get source pointers (added by migration 20260426000001).
  const subRes = await supabase
    .from("subs")
    .select("source_extraction_id, source_drawing_id")
    .eq("id", subId)
    .maybeSingle();
  if (subRes.error) throw subRes.error;
  const source_extraction_id =
    (subRes.data?.source_extraction_id as string | null) ?? null;
  const source_drawing_id =
    (subRes.data?.source_drawing_id as string | null) ?? null;

  // 2. Materials (project-scoped, assigned to this sub).
  const materialsRes = await supabase
    .from("materials")
    .select("id, product_name, manufacturer, supplier, status, qty, price")
    .eq("project_id", projectId)
    .eq("assigned_sub_id", subId)
    .order("product_name", { ascending: true });
  if (materialsRes.error) throw materialsRes.error;

  // 3. Subcontractor agreements (Paperwork).
  const agreementsRes = await supabase
    .from("subcontractor_agreements")
    .select(
      "id, contract_number, trade, contract_value, start_date, completion_date, status, pdf_url",
    )
    .eq("project_id", projectId)
    .eq("sub_id", subId)
    .order("created_at", { ascending: false });
  if (agreementsRes.error) throw agreementsRes.error;

  // 4. Change orders (filter to ones that affect a sub contract for this sub).
  const coRes = await supabase
    .from("contract_change_orders")
    .select("id, co_number, co_date, description, amount, status")
    .eq("project_id", projectId)
    .eq("sub_id", subId)
    .order("co_number", { ascending: true });
  if (coRes.error) throw coRes.error;

  // 5. Sub requisitions (Billing).
  const reqRes = await supabase
    .from("sub_requisitions")
    .select(
      "id, period_start, period_end, scheduled_value, work_completed_to_date, amount_due, status, created_at",
    )
    .eq("project_id", projectId)
    .eq("sub_id", subId)
    .order("created_at", { ascending: false });
  if (reqRes.error) throw reqRes.error;

  // 6. Schedule tasks via project_subs link.
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
    if (source_extraction_id) {
      const eRes = await supabase
        .from("drawing_extractions")
        .select("label, description, category")
        .eq("id", source_extraction_id)
        .maybeSingle();
      if (!eRes.error && eRes.data) {
        plan_link.extraction_label = eRes.data.label ?? null;
        plan_link.extraction_description = eRes.data.description ?? null;
        plan_link.extraction_category = eRes.data.category ?? null;
      }
    }
  }

  return {
    source_extraction_id,
    source_drawing_id,
    materials: (materialsRes.data ?? []) as ContractorMaterial[],
    agreements: (agreementsRes.data ?? []) as ContractorAgreement[],
    change_orders: (coRes.data ?? []) as ContractorChangeOrder[],
    requisitions: (reqRes.data ?? []) as ContractorRequisition[],
    schedule_tasks,
    jobs,
    plan_link,
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
