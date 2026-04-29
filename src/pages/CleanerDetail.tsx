import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { downloadXlsx, isCurrent } from "@/lib/exports";

export default function CleanerDetail() {
  const { cleanerId = "" } = useParams();
  const { isAdmin } = useAuth();
  const [c, setC] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [showHistorical, setShowHistorical] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cleaner } = await supabase.from("cleaners").select("*").eq("cleaner_id", cleanerId).maybeSingle();
      setC(cleaner);
      const { data: sites } = await supabase.from("sites").select("site_id,client_name");
      const sMap = new Map((sites ?? []).map((s) => [s.site_id, s.client_name]));
      const { data: sch } = await supabase.from("schedule").select("*").eq("cleaner_id", cleanerId);
      setSchedule((sch ?? []).map((r: any) => ({ ...r, site_name: sMap.get(r.site_id) ?? r.site_id })));
      const { data: dl } = await supabase.from("delivery_log").select("*").eq("cleaner_id", cleanerId).order("date", { ascending: false }).limit(100);
      setDelivery((dl ?? []).map((r) => ({ ...r, site_name: sMap.get(r.site_id) ?? r.site_id })));
      setLoading(false);
    })();
  }, [cleanerId]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!c) return <div className="p-6">Cleaner not found.</div>;

  const visible = showHistorical ? schedule : schedule.filter((r) => isCurrent(r.effective_to));

  const exportTimesheet = () => {
    downloadXlsx(`${c.cleaner_id}-timesheet.xlsx`, [
      { name: "Cleaner", rows: [c] },
      { name: "Schedule", rows: visible.map(({ pk, version_id, ...r }) => r) },
      { name: "Delivery", rows: delivery.map(({ pk, version_id, ...r }) => r) },
    ]);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link to="/cleaners" className="text-sm text-muted-foreground hover:underline">← Cleaners</Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name ?? c.cleaner_id}</h1>
            <p className="text-sm text-muted-foreground">{c.cleaner_id} · {c.region_primary ?? "—"}</p>
          </div>
          <Button variant="outline" onClick={exportTimesheet}>Export Timesheet (Excel)</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label="Phone" v={c.phone} />
            <Field label="Email" v={c.email} />
            <Field label="Type" v={c.employment_type} />
            <Field label="Team" v={c.team_id} />
            <Field label="Active" v={c.active} />
            <Field label="Sub-NLW" v={c.sub_nlw_flag} />
            <Field label="Notes" v={c.notes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label="Right to work" v={c.right_to_work_on_file} />
            <Field label="DBS done" v={c.dbs_done} />
            <Field label="DBS date" v={c.dbs_date} />
            <Field label="Safeguarding" v={c.safeguarding_done} />
            <Field label="PAT (own kit)" v={c.pat_test_personal_kit} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Schedule ({visible.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowHistorical((s) => !s)}>
            {showHistorical ? "Show current only" : "Include closed records"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead><TableHead>Day</TableHead><TableHead>Hours</TableHead>
                <TableHead>Role</TableHead>{isAdmin && <TableHead>Pay rate</TableHead>}
                <TableHead>Effective</TableHead><TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.pk}>
                  <TableCell><Link to={`/sites/${encodeURIComponent(r.site_id)}`} className="hover:underline">{r.site_name}</Link></TableCell>
                  <TableCell>{r.day_of_week}</TableCell>
                  <TableCell>{r.duration_hours ?? "—"}</TableCell>
                  <TableCell>{r.shift_role ?? "—"}</TableCell>
                  {isAdmin && <TableCell>{r.pay_rate ? `£${r.pay_rate}` : "—"}</TableCell>}
                  <TableCell className="text-xs text-muted-foreground">{r.effective_from ?? "—"} → {r.effective_to ?? "open"}</TableCell>
                  <TableCell>{r.confidence ? <Badge variant="secondary">{r.confidence}</Badge> : <Badge variant="outline">High</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent delivery (last 100)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Site</TableHead><TableHead>Hours</TableHead></TableRow></TableHeader>
            <TableBody>
              {delivery.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No records.</TableCell></TableRow>}
              {delivery.map((r) => <TableRow key={r.pk}><TableCell>{r.date}</TableCell><TableCell>{r.site_name}</TableCell><TableCell>{r.hours_clocked}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, v }: { label: string; v: any }) {
  return <div className="flex gap-2"><span className="w-32 shrink-0 text-muted-foreground">{label}</span><span>{v ?? "—"}</span></div>;
}
