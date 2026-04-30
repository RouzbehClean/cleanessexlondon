import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const Body = z.object({
  user_id: z.string().uuid(),
});

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
    const requester = userData.user;
    if (!requester) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: requesterRoles } = await admin.from("user_roles").select("role").eq("user_id", requester.id);
    if (!requesterRoles?.some((r) => r.role === "admin")) return json({ error: "Admin role required" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { user_id } = parsed.data;

    if (user_id === requester.id) return json({ error: "You can't delete your own account while signed in" }, 400);

    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", user_id);
    const isTargetAdmin = targetRoles?.some((r) => r.role === "admin") ?? false;
    if (isTargetAdmin) {
      const { count } = await admin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) return json({ error: "You can't delete the last admin account" }, 400);
    }

    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) return json({ error: authErr.message }, 500);

    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("id", user_id);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
