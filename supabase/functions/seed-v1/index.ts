// One-shot bootstrap: seed v1 from the bundled Master Inventory file URL provided in body.
// Also makes the calling user an admin (only allowed if there are zero existing admins).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { parseWorkbook, validate, transform } from "../_shared/parse-xlsx.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Bootstrap admin: only if there are zero admins, promote caller.
    const { count } = await admin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) === 0) {
      await admin.from("profiles").upsert({ id: userData.user.id, email: userData.user.email, display_name: userData.user.email });
      await admin.from("user_roles").insert({ user_id: userData.user.id, role: "admin" });
    } else {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
      if (!roles?.some((r) => r.role === "admin")) return json({ error: "Admin role required" }, 403);
    }

    // Don't re-seed if a v1 already exists
    const { data: existing } = await admin.from("data_versions").select("id").eq("label", "v1 (seed)").maybeSingle();
    if (existing) return json({ ok: true, already_seeded: true });

    // Accept the xlsx as raw bytes in the request body (POST application/octet-stream)
    const buf = await req.arrayBuffer();
    if (!buf || buf.byteLength === 0) return json({ error: "Empty file body" }, 400);

    const parsed = parseWorkbook(buf);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const errors = validate(parsed.data!);
    if (errors.length) return json({ error: "Validation failed", validation_errors: errors.slice(0, 50) }, 422);

    const { data: version, error: vErr } = await admin
      .from("data_versions")
      .insert({
        label: "v1 (seed)",
        notes: "Initial seed from Master_Inventory_v9_2904.xlsx",
        is_active: true,
        activated_at: new Date().toISOString(),
        source_filename: "Master_Inventory_v9_2904.xlsx",
        uploaded_by: userData.user.id,
        row_counts: {
          sites: parsed.data!.sites.length,
          cleaners: parsed.data!.cleaners.length,
          schedule: parsed.data!.schedule.length,
          closures: parsed.data!.closures.length,
          delivery_log: parsed.data!.delivery_log.length,
        },
      })
      .select()
      .single();
    if (vErr) return json({ error: vErr.message }, 500);

    const t = transform(parsed.data!, version.id);
    const chunks = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    for (const [name, rows] of [
      ["sites", t.sites], ["cleaners", t.cleaners], ["schedule", t.schedule],
      ["closures", t.closures], ["delivery_log", t.delivery_log],
    ] as const) {
      for (const c of chunks(rows)) {
        const { error } = await admin.from(name).insert(c);
        if (error) { await admin.from("data_versions").delete().eq("id", version.id); return json({ error: `${name}: ${error.message}` }, 500); }
      }
    }

    return json({ ok: true, version });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
