import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { downloadXlsx, isCurrent } from "@/lib/exports";

export default function SiteDetail() {
  const { siteId = "" } = useParams();
  const { isAdmin } = useAuth();
  const [site, setSite] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [showHistorical, setShowHistorical] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from("sites_safe").select("*").eq("site_id", siteId).maybeSingle();
      setSite(s);
      const { data: sch } = await supabase
        .from("schedule_safe")
        .select("*, cleaners:cleaner_id(name, region_primary)")
        .eq("site_id", siteId)
        .order("day_of_week");
      // join cleaner name manually since FK isn't declared
      const { data: cleanersAll } = await supabase.from("cleaners").select("cleaner_id,name");
      const cMap = new Map((cleanersAll ?? []).map((c) => [c.cleaner_id, c.name]));
      setSchedule((sch ?? []).map((r: any) => ({ ...r, cleaner_name: cMap.get(r.cleaner_id) ?? r.cleaner_id })));

      const { data: dl } = await supabase
        .from("delivery_log").select("*").eq("site_id", siteId).order("date", { ascending: false }).limit(50);
      setDelivery((dl ?? []).map((r) => ({ ...r, cleaner_name: cMap.get(r.cleaner_id) ?? r.cleaner_id })));

      const { data: cl } = await supabase.from("closures").select("*").order("date");
      setClosures(cl ?? []);
      setLoading(false);
    })();
  }, [siteId]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!site) return <div className="p-6">Site not found.</div>;

  const visibleSchedule = showHistorical ? schedule : schedule.filter((r) => isCurrent(r.effective_to));

  const exportSchedule = () => {
    downloadXlsx(`${site.site_id}-schedule.xlsx`, [
      { name: "Site", rows: [site] },
      { name: "Schedule", rows: visibleSchedule.map(({ pk, version_id, ...r }) => r) },
    ]);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link to="/sites" className="text-sm text-muted-foreground hover:underline">← Sites</Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{site.client_name ?? site.site_id}</h1>
            <p className="text-sm text-muted-foreground">{site.site_id} · {site.region ?? "—"} · {site.postcode ?? ""}</p>
          </div>
          <Button variant="outline" onClick={exportSchedule}>Export Schedule (Excel)</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Front sheet</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label="Address" v={site.address} />
            <Field label="Contact" v={site.site_contact_name} />
            <Field label="Phone" v={site.site_contact_phone} />
            <Field label="Email" v={site.site_contact_email} />
            <Field label="Access" v={site.access_method} />
            <Field label="Access notes" v={site.access_instructions} />
            <Field label="Alarm" v={site.alarm_info} />
            <Field label="Cupboard codes" v={site.cupboard_codes} />
            <Field label="Products" v={site.products_supplied_by} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Contract</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label="Type" v={site.contract_type} />
            <Field label="Term-time only" v={site.term_time_only} />
            <Field label="Start" v={site.contract_start} />
            <Field label="End" v={site.contract_end} />
            <Field label="Active" v={site.active} />
            <Field label="Team grouping" v={site.team_grouping} />
            {isAdmin && <Field label="Charge rate" v={site.billing_rate_default ? `£${site.billing_rate_default}` : "Not yet populated"} />}
            <Field label="PAT test due" v={site.pat_test_due} />
            <Field label="Notes" v={site.general_notes} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Schedule ({visibleSchedule.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowHistorical((s) => !s)}>
            {showHistorical ? "Show current only" : "Include closed records"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Cleaner</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Role</TableHead>
                {isAdmin && <TableHead>Pay rate</TableHead>}
                <TableHead>Effective</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSchedule.map((r) => (
                <TableRow key={r.pk}>
                  <TableCell>{r.day_of_week}</TableCell>
                  <TableCell><Link to={`/cleaners/${encodeURIComponent(r.cleaner_id)}`} className="hover:underline">{r.cleaner_name}</Link></TableCell>
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
        <CardHeader><CardTitle className="text-base">Recent delivery (last 50)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Cleaner</TableHead><TableHead>Hours</TableHead></TableRow></TableHeader>
            <TableBody>
              {delivery.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No delivery records.</TableCell></TableRow>}
              {delivery.map((r) => (
                <TableRow key={r.pk}><TableCell>{r.date}</TableCell><TableCell>{r.cleaner_name}</TableCell><TableCell>{r.hours_clocked}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Closures (all)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
            <TableBody>{closures.map((c) => <TableRow key={c.pk}><TableCell>{c.date}</TableCell><TableCell>{c.type}</TableCell><TableCell>{c.description}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, v }: { label: string; v: any }) {
  return <div className="flex gap-2"><span className="w-32 shrink-0 text-muted-foreground">{label}</span><span>{v ?? "—"}</span></div>;
}
