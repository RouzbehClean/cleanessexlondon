import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, isAdmin, isCleaner, isClient, refreshRoles } = useAuth();
  const [counts, setCounts] = useState<{ sites: number; cleaners: number; schedule: number } | null>(null);
  const [hasVersion, setHasVersion] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { count: vCount } = await supabase.from("data_versions").select("*", { count: "exact", head: true });
      setHasVersion((vCount ?? 0) > 0);
      const [s, c, sc] = await Promise.all([
        supabase.from("sites").select("*", { count: "exact", head: true }),
        supabase.from("cleaners").select("*", { count: "exact", head: true }),
        supabase.from("schedule").select("*", { count: "exact", head: true }),
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome{user?.email ? `, ${user.email}` : ""}</h1>
        <p className="text-sm text-muted-foreground">
          Role: {isAdmin ? "Admin" : isCleaner ? "Cleaner" : isClient ? "Client" : "No role assigned — ask an admin"}
        </p>
      </div>

      {hasVersion === false && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>First-time setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No data has been loaded yet. Upload <code>Master_Inventory_v9_2904.xlsx</code> to seed v1 and become the first admin.
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

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/sites"><Card className="transition hover:shadow-md"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Sites</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{counts?.sites ?? "—"}</div></CardContent></Card></Link>
        <Link to="/cleaners"><Card className="transition hover:shadow-md"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Cleaners</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{counts?.cleaners ?? "—"}</div></CardContent></Card></Link>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base">Schedule rows</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{counts?.schedule ?? "—"}</div></CardContent></Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" />Admin shortcuts</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild variant="outline"><Link to="/uploads">Upload new version</Link></Button>
            <Button asChild variant="outline"><Link to="/users">Invite team member</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
