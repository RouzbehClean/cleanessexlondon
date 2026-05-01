import { supabase } from "@/integrations/supabase/client";

/**
 * "Live overrides" layer. Staff edits are stored in *_overrides tables
 * and merged on read via *_live views. This survives Excel re-uploads.
 *
 * Entities supported: sites, cleaners, schedule, delivery, closures.
 */

export type OverrideEntity = "sites" | "cleaners" | "schedule" | "delivery" | "closures";

const ENTITY_CONFIG: Record<
  OverrideEntity,
  { table: string; overridesTable: string; liveView: string; idField: string }
> = {
  sites:    { table: "sites",        overridesTable: "sites_overrides",    liveView: "sites_live",    idField: "site_id" },
  cleaners: { table: "cleaners",     overridesTable: "cleaners_overrides", liveView: "cleaners_live", idField: "cleaner_id" },
  schedule: { table: "schedule",     overridesTable: "schedule_overrides", liveView: "schedule_live", idField: "schedule_id" },
  delivery: { table: "delivery_log", overridesTable: "delivery_overrides", liveView: "delivery_live", idField: "delivery_id" },
  closures: { table: "closures",     overridesTable: "closures_overrides", liveView: "closures_live", idField: "closure_id" },
};

export function entityConfig(e: OverrideEntity) {
  return ENTITY_CONFIG[e];
}

/** Get the active data version id, or null if none. */
export async function getActiveVersionId(): Promise<string | null> {
  const { data } = await supabase
    .from("data_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return data?.id ?? null;
}

/** Strip view-only fields before storing as payload. */
function cleanPayload(payload: Record<string, any>) {
  const { override_id, edited_by, edited_at, is_overridden, ...rest } = payload;
  return rest;
}

/**
 * Save an upsert override (covers both "add new" and "edit existing").
 * `targetId` is the entity's natural key (site_id / cleaner_id / etc).
 * `payload` is the full intended row.
 */
export async function saveUpsert(
  entity: OverrideEntity,
  targetId: string,
  payload: Record<string, any>,
  note?: string
) {
  const cfg = ENTITY_CONFIG[entity];
  const versionId = await getActiveVersionId();
  if (!versionId) throw new Error("No active data version. Ask an admin to activate one.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const row: any = {
    version_id: versionId,
    op: "upsert",
    [cfg.idField]: targetId,
    payload: cleanPayload({ ...payload, [cfg.idField]: targetId }),
    note: note ?? null,
    edited_by: user.id,
  };
  const { error } = await supabase.from(cfg.overridesTable as any).insert(row);
  if (error) throw error;
}

/** Save a delete override (soft-hides the row from live views). */
export async function saveDelete(
  entity: OverrideEntity,
  targetId: string,
  note?: string
) {
  const cfg = ENTITY_CONFIG[entity];
  const versionId = await getActiveVersionId();
  if (!versionId) throw new Error("No active data version.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const row: any = {
    version_id: versionId,
    op: "delete",
    [cfg.idField]: targetId,
    payload: null,
    note: note ?? null,
    edited_by: user.id,
  };
  const { error } = await supabase.from(cfg.overridesTable as any).insert(row);
  if (error) throw error;
}

/** Admin: revert an override (mark inactive). Audit trail preserved. */
export async function revertOverride(entity: OverrideEntity, overrideId: string) {
  const cfg = ENTITY_CONFIG[entity];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from(cfg.overridesTable as any)
    .update({ is_active: false, reverted_by: user.id, reverted_at: new Date().toISOString() })
    .eq("id", overrideId);
  if (error) throw error;
}

/** Generate a deterministic-ish new ID for a brand-new record. */
export function newEntityId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
