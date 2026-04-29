// Admin invites a user by email + assigns role + (cleaner_id | site_id) link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const Body = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "cleaner", "client"]),
  display_name: z.string().min(1).max(200).optional(),
  cleaner_id: z.string().optional().nullable(),
  site_id: z.string().optional().nullable(),
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
    if (!userData.user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!roles?.some((r) => r.role === "admin")) return json({ error: "Admin role required" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { email, role, display_name, cleaner_id, site_id } = parsed.data;

    if (role === "cleaner" && !cleaner_id) return json({ error: "cleaner_id required for cleaner role" }, 400);
    if (role === "client" && !site_id) return json({ error: "site_id required for client role" }, 400);

    // Invite user (sends magic link / set password email)
    const redirectTo = req.headers.get("origin") || undefined;
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: display_name ?? email },
      redirectTo: redirectTo ? `${redirectTo}/set-password` : undefined,
    });

    let userId: string | null = invited?.user?.id ?? null;
    if (invErr) {
      // If already exists, look them up
      if (/already/i.test(invErr.message)) {
        const { data: list } = await admin.auth.admin.listUsers();
        userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      } else {
        return json({ error: invErr.message }, 500);
      }
    }
    if (!userId) return json({ error: "Could not create or locate user" }, 500);

    // Upsert profile
    await admin.from("profiles").upsert({ id: userId, email, display_name: display_name ?? email });

    // Assign role
    const { error: rErr } = await admin.from("user_roles").upsert({
      user_id: userId, role,
      cleaner_id: role === "cleaner" ? cleaner_id : null,
      site_id: role === "client" ? site_id : null,
    }, { onConflict: "user_id,role" });
    if (rErr) return json({ error: rErr.message }, 500);

    return json({ ok: true, user_id: userId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
