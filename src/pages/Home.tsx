import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Upload, CalendarClock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, isAdmin, refreshRoles } = useAuth();
  const [counts, setCounts] = useState<{ sites: number; cleaners: number; schedule: number } | null>(null);
  const [hasVersion, setHasVersion] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { count: vCount } = await supabase.from("data_versions").select("*", { count: "exact", head: true });
      setHasVersion((vCount ?? 0) > 0);
      const [s, c, sc] = await Promise.all([
        supabase.from("sites_live" as any).select("*", { count: "exact", head: true }),
        supabase.from("cleaners_live" as any).select("*", { count: "exact", head: true }),
        supabase.from("schedule_live" as any).select("*", { count: "exact", head: true }),
      ]);
      setCounts({ sites: s.count ?? 0, cleaners: c.count ?? 0, schedule: sc.count ?? 0 });
    })();
  }, []);

  const seed = async (file: File) => {
    setSeeding(true);
    try {
      const buf = await file.arrayBuffer();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-v1`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/octet-stream",
        },
        body: buf,
      });
      const data = await resp.json();
      if (!resp.ok || data?.error) {
        const ve = data?.validation_errors as Array<{sheet:string;row_index:number;field:string;message:string}> | undefined;
        if (ve?.length) {
          console.error("Validation errors:", ve);
          toast.error(`Validation failed (${ve.length} issue${ve.length>1?"s":""}). First: ${ve[0].sheet} row ${ve[0].row_index} — ${ve[0].message}. See console for full list.`, { duration: 12000 });
        } else {
          toast.error("Seed failed: " + (data?.error || resp.statusText));
        }
      } else {
        toast.success("Data loaded — you are now admin");
        await refreshRoles();
        window.location.reload();
      }
    } finally {
      setSeeding(false);
    }
  };

  const stats = [
    { label: "Sites", value: counts?.sites, to: "/sites", icon: Building2, gradient: "from-indigo-500 to-violet-500" },
    { label: "Cleaners", value: counts?.cleaners, to: "/cleaners", icon: Users, gradient: "from-teal-500 to-cyan-500" },
    { label: "Schedule rows", value: counts?.schedule, to: null, icon: CalendarClock, gradient: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-8 text-primary-foreground shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            Signed in as <span className="font-medium">{isAdmin ? "Admin (owner)" : "Staff"}</span>
          </p>
          <div className="mt-4">
            <Button asChild variant="secondary" size="sm">
              <Link to="/today"><CalendarClock className="mr-2 h-4 w-4" />View today's schedule</Link>
            </Button>
          </div>
        </div>
      </div>

      {hasVersion === false && (
        <Card className="border-dashed border-accent/50 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base">First-time setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No data has been loaded yet. Upload <code className="rounded bg-muted px-1 py-0.5 text-xs">Master_Inventory_v9_2904.xlsx</code> to seed v1 and become the first admin.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) seed(f); }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={seeding}>
              {seeding ? "Loading data…" : "Upload Master Inventory & Initialize"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          const inner = (
            <Card className="group h-full overflow-hidden border-border/60 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} text-white shadow-md`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {s.to && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  )}
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-tight">{s.value ?? "—"}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          );
          return s.to ? <Link key={s.label} to={s.to}>{inner}</Link> : <div key={s.label}>{inner}</div>;
        })}
      </div>

      {isAdmin && (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-accent" />Admin shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/uploads">Upload new version</Link></Button>
            <Button asChild variant="outline"><Link to="/users">Invite team member</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
