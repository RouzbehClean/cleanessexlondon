// Shared xlsx parsing + validation logic
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

export type SheetRow = Record<string, unknown>;

export interface ParsedWorkbook {
  sites: SheetRow[];
  cleaners: SheetRow[];
  schedule: SheetRow[];
  closures: SheetRow[];
  delivery_log: SheetRow[];
}

export interface ValidationError {
  sheet: string;
  row_index: number; // 1-based excel row (excluding header)
  field: string;
  value: unknown;
  message: string;
}

const SHEET_ALIASES: Record<keyof ParsedWorkbook, string[]> = {
  sites: ["Sites", "sites"],
  cleaners: ["Cleaners", "cleaners"],
  schedule: ["Schedule", "schedule"],
  closures: ["Closures", "closures"],
  delivery_log: ["Delivery_Log", "delivery_log", "DeliveryLog", "Delivery Log"],
};

function findSheet(wb: XLSX.WorkBook, names: string[]): string | null {
  for (const n of names) if (wb.SheetNames.includes(n)) return n;
  return null;
}

function toIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // Already ISO?
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[£$,]/g, ""));
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function parseWorkbook(buf: ArrayBuffer): { data?: ParsedWorkbook; error?: string } {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const result: Partial<ParsedWorkbook> = {};
  for (const key of Object.keys(SHEET_ALIASES) as (keyof ParsedWorkbook)[]) {
    const name = findSheet(wb, SHEET_ALIASES[key]);
    if (!name) return { error: `Missing sheet: ${SHEET_ALIASES[key][0]}` };
    const ws = wb.Sheets[name];
    result[key] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  }
  return { data: result as ParsedWorkbook };
}

export function validate(data: ParsedWorkbook): ValidationError[] {
  const errors: ValidationError[] = [];
  const siteIds = new Set(data.sites.map((r) => toStr(r.site_id)).filter(Boolean) as string[]);
  const cleanerIds = new Set(data.cleaners.map((r) => toStr(r.cleaner_id)).filter(Boolean) as string[]);

  data.sites.forEach((r, i) => {
    if (!toStr(r.site_id)) errors.push({ sheet: "Sites", row_index: i + 2, field: "site_id", value: r.site_id, message: "site_id is required" });
  });
  data.cleaners.forEach((r, i) => {
    if (!toStr(r.cleaner_id)) errors.push({ sheet: "Cleaners", row_index: i + 2, field: "cleaner_id", value: r.cleaner_id, message: "cleaner_id is required" });
  });

  data.schedule.forEach((r, i) => {
    const sid = toStr(r.site_id);
    const cid = toStr(r.cleaner_id);
    if (!toStr(r.schedule_id)) errors.push({ sheet: "Schedule", row_index: i + 2, field: "schedule_id", value: r.schedule_id, message: "schedule_id is required" });
    if (!sid) errors.push({ sheet: "Schedule", row_index: i + 2, field: "site_id", value: r.site_id, message: "site_id is required" });
    else if (!siteIds.has(sid)) errors.push({ sheet: "Schedule", row_index: i + 2, field: "site_id", value: sid, message: `site_id '${sid}' does not exist in Sites` });
    if (!cid) errors.push({ sheet: "Schedule", row_index: i + 2, field: "cleaner_id", value: r.cleaner_id, message: "cleaner_id is required" });
    else if (!cleanerIds.has(cid)) errors.push({ sheet: "Schedule", row_index: i + 2, field: "cleaner_id", value: cid, message: `cleaner_id '${cid}' does not exist in Cleaners` });
  });

  data.delivery_log.forEach((r, i) => {
    const sid = toStr(r.site_id);
    const cid = toStr(r.cleaner_id);
    if (!toStr(r.delivery_id)) errors.push({ sheet: "Delivery_Log", row_index: i + 2, field: "delivery_id", value: r.delivery_id, message: "delivery_id is required" });
    if (!sid) errors.push({ sheet: "Delivery_Log", row_index: i + 2, field: "site_id", value: r.site_id, message: "site_id is required" });
    else if (!siteIds.has(sid)) errors.push({ sheet: "Delivery_Log", row_index: i + 2, field: "site_id", value: sid, message: `site_id '${sid}' does not exist in Sites` });
    if (!cid) errors.push({ sheet: "Delivery_Log", row_index: i + 2, field: "cleaner_id", value: r.cleaner_id, message: "cleaner_id is required" });
    else if (!cleanerIds.has(cid)) errors.push({ sheet: "Delivery_Log", row_index: i + 2, field: "cleaner_id", value: cid, message: `cleaner_id '${cid}' does not exist in Cleaners` });
  });

  return errors;
}

export function transform(data: ParsedWorkbook, versionId: string) {
  return {
    sites: data.sites.map((r) => ({
      version_id: versionId,
      site_id: toStr(r.site_id)!,
      client_name: toStr(r.client_name),
      region: toStr(r.region),
      postcode: toStr(r.postcode),
      address: toStr(r.address),
      site_contact_name: toStr(r.site_contact_name),
      site_contact_phone: toStr(r.site_contact_phone),
      site_contact_email: toStr(r.site_contact_email),
      access_method: toStr(r.access_method),
      access_instructions: toStr(r.access_instructions),
      alarm_info: toStr(r.alarm_info),
      cupboard_codes: toStr(r.cupboard_codes),
      products_supplied_by: toStr(r.products_supplied_by),
      products_notes: toStr(r.products_notes),
      billing_rate_default: toNum(r.billing_rate_default),
      contract_type: toStr(r.contract_type),
      term_time_only: toStr(r.term_time_only),
      contract_start: toIso(r.contract_start),
      contract_end: toIso(r.contract_end),
      active: toStr(r.active),
      pat_test_due: toIso(r.pat_test_due),
      hs_folder_last_updated: toIso(r.hs_folder_last_updated),
      general_notes: toStr(r.general_notes),
      team_grouping: toStr(r.team_grouping),
    })),
    cleaners: data.cleaners.map((r) => ({
      version_id: versionId,
      cleaner_id: toStr(r.cleaner_id)!,
      name: toStr(r.name),
      phone: toStr(r.phone),
      email: toStr(r.email),
      region_primary: toStr(r.region_primary),
      employment_type: toStr(r.employment_type),
      right_to_work_on_file: toStr(r.right_to_work_on_file),
      dbs_done: toStr(r.dbs_done),
      dbs_date: toIso(r.dbs_date),
      safeguarding_done: toStr(r.safeguarding_done),
      pat_test_personal_kit: toStr(r.pat_test_personal_kit),
      team_id: toStr(r.team_id),
      active: toStr(r.active),
      sub_nlw_flag: toStr(r.sub_nlw_flag),
      notes: toStr(r.notes),
    })),
    schedule: data.schedule.map((r) => ({
      version_id: versionId,
      schedule_id: toStr(r.schedule_id)!,
      site_id: toStr(r.site_id)!,
      cleaner_id: toStr(r.cleaner_id)!,
      day_of_week: toStr(r.day_of_week),
      start_time: toStr(r.start_time),
      duration_hours: toNum(r.duration_hours),
      shift_group_id: toStr(r.shift_group_id),
      pay_rate: toNum(r.pay_rate),
      billing_rate_override: toNum(r.billing_rate_override),
      effective_from: toIso(r.effective_from),
      effective_to: toIso(r.effective_to),
      shift_role: toStr(r.shift_role),
      visits_in_apr_2026: toNum(r.visits_in_apr_2026),
      confidence: toStr(r.confidence),
      notes: toStr(r.notes),
    })),
    closures: data.closures.map((r) => ({
      version_id: versionId,
      closure_id: toStr(r.closure_id)!,
      date: toIso(r.date),
      type: toStr(r.type),
      affects: toStr(r.affects),
      description: toStr(r.description),
    })),
    delivery_log: data.delivery_log.map((r) => ({
      version_id: versionId,
      delivery_id: toStr(r.delivery_id)!,
      date: toIso(r.date),
      site_id: toStr(r.site_id)!,
      cleaner_id: toStr(r.cleaner_id)!,
      hours_clocked: toNum(r.hours_clocked),
      pay_rate_at_time: toNum(r.pay_rate_at_time),
      source: toStr(r.source),
      notes: toStr(r.notes),
    })),
  };
}
