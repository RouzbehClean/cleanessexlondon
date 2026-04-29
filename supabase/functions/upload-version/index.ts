// Admin uploads xlsx -> validate FKs -> insert as draft version (is_active=false).
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
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!roles?.some((r) => r.role === "admin")) return json({ error: "Admin role required" }, 403);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const label = (form.get("label") as string | null) || `Upload ${new Date().toISOString()}`;
    const notes = (form.get("notes") as string | null) || null;
    if (!file) return json({ error: "file is required" }, 400);

    const buf = await file.arrayBuffer();
    const parsed = parseWorkbook(buf);
    if (parsed.error) return json({ error: parsed.error }, 400);

    const errors = validate(parsed.data!);
    if (errors.length) return json({ error: "Validation failed", validation_errors: errors }, 422);

    // Create draft version (is_active = false)
    const { data: version, error: vErr } = await admin
      .from("data_versions")
      .insert({
        label,
        notes,
        is_active: false,
        source_filename: file.name,
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

    // Bulk inserts in chunks of 500
    const chunks = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    for (const c of chunks(t.sites)) {
      const { error } = await admin.from("sites").insert(c);
      if (error) { await admin.from("data_versions").delete().eq("id", version.id); return json({ error: `sites: ${error.message}` }, 500); }
    }
    for (const c of chunks(t.cleaners)) {
      const { error } = await admin.from("cleaners").insert(c);
      if (error) { await admin.from("data_versions").delete().eq("id", version.id); return json({ error: `cleaners: ${error.message}` }, 500); }
    }
    for (const c of chunks(t.schedule)) {
      const { error } = await admin.from("schedule").insert(c);
      if (error) { await admin.from("data_versions").delete().eq("id", version.id); return json({ error: `schedule: ${error.message}` }, 500); }
    }
    for (const c of chunks(t.closures)) {
      const { error } = await admin.from("closures").insert(c);
      if (error) { await admin.from("data_versions").delete().eq("id", version.id); return json({ error: `closures: ${error.message}` }, 500); }
    }
    for (const c of chunks(t.delivery_log)) {
      const { error } = await admin.from("delivery_log").insert(c);
      if (error) { await admin.from("data_versions").delete().eq("id", version.id); return json({ error: `delivery_log: ${error.message}` }, 500); }
    }

    return json({ ok: true, version });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
