import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { downloadXlsx, isCurrent } from "@/lib/exports";
import { AlertTriangle, CheckCircle2, XCircle, Clock, Pencil } from "lucide-react";
import EntityFormDialog, { FieldDef } from "@/components/EntityFormDialog";

const CLEANER_FIELDS: FieldDef[] = [
  { key: "cleaner_id", label: "Cleaner ID", required: true, half: true, disabled: true },
  { key: "name", label: "Name", required: true, half: true },
  { key: "phone", label: "Phone", half: true },
  { key: "email", label: "Email", half: true },
  { key: "region_primary", label: "Primary region", half: true },
  { key: "team_id", label: "Team", half: true },
  { key: "employment_type", label: "Employment type", type: "select", options: ["Employee", "Self-employed", "Agency"], half: true },
  { key: "active", label: "Active", type: "select", options: ["Y", "N"], half: true },
  { key: "sub_nlw_flag", label: "Sub-NLW", type: "select", options: ["Y", "N"], half: true, adminOnly: true },
  { key: "starter_checklist_completed", label: "Starter checklist completed", type: "select", options: ["Y", "N"], half: true },
  { key: "right_to_work_on_file", label: "Right to work on file", type: "select", options: ["Y", "N"], half: true },
  { key: "right_to_work_expiry", label: "Right to work expiry", type: "date", half: true },
  { key: "id_document_type", label: "ID document", type: "select", options: ["Passport", "Driving licence"], half: true },
  { key: "dbs_done", label: "DBS done", type: "select", options: ["Y", "N"], half: true },
  { key: "dbs_date", label: "DBS date", type: "date", half: true },
  { key: "safeguarding_done", label: "Safeguarding done", type: "select", options: ["Y", "N"], half: true },
  { key: "pat_test_personal_kit", label: "PAT (own kit)", type: "select", options: ["Y", "N"], half: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "yes/y/true/1" → true. Empty/no → false. Unknown → null.
function parseBool(v: any): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["yes", "y", "true", "1", "done", "ok"].includes(s)) return true;
  if (["no", "n", "false", "0", "missing", "outstanding"].includes(s)) return false;
  return null;
}

function complianceStatus(label: string, value: any, dateValue?: any) {
  const b = parseBool(value);
  // DBS expiry: warn if older than 3 years
  let expiringSoon = false;
  let expired = false;
  if (label === "DBS" && dateValue) {
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) {
      const months = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (months >= 36) expired = true;
      else if (months >= 30) expiringSoon = true;
    }
  }
  return { ok: b === true && !expired, missing: b === false || b === null, expired, expiringSoon, raw: value };
}

export default function CleanerDetail() {
  const { cleanerId = "" } = useParams();
  const { isAdmin } = useAuth();
  const [c, setC] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [showHistorical, setShowHistorical] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  async function reload() {
    const { data: cleaner } = await supabase.from("cleaners_live" as any).select("*").eq("cleaner_id", cleanerId).maybeSingle();
    setC(cleaner);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cleaner } = await supabase.from("cleaners_live" as any).select("*").eq("cleaner_id", cleanerId).maybeSingle();
      setC(cleaner);
      const { data: sites } = await supabase.from("sites_live" as any).select("site_id,client_name");
      const sMap = new Map(((sites ?? []) as any[]).map((s: any) => [s.site_id, s.client_name]));
      const { data: sch } = await supabase.from("schedule_live" as any).select("*").eq("cleaner_id", cleanerId);
      setSchedule(((sch ?? []) as any[]).map((r: any) => ({ ...r, site_name: sMap.get(r.site_id) ?? r.site_id })));
      const { data: dl } = await supabase.from("delivery_live" as any).select("*").eq("cleaner_id", cleanerId).order("date", { ascending: false }).limit(500);
      setDelivery(((dl ?? []) as any[]).map((r: any) => ({ ...r, site_name: sMap.get(r.site_id) ?? r.site_id })));
      setLoading(false);
    })();
  }, [cleanerId]);

  const visible = useMemo(
    () => (showHistorical ? schedule : schedule.filter((r) => isCurrent(r.effective_to))),
    [schedule, showHistorical]
  );

  // Weekly scheduled summary
  const weekly = useMemo(() => {
    const current = schedule.filter((r) => isCurrent(r.effective_to));
    let totalHours = 0;
    let totalPay = 0;
    const byDay: Record<string, number> = {};
    const sites = new Set<string>();
    current.forEach((r) => {
      const h = Number(r.duration_hours) || 0;
      totalHours += h;
      totalPay += h * (Number(r.pay_rate) || 0);
      const day = (r.day_of_week ?? "").slice(0, 3);
      byDay[day] = (byDay[day] ?? 0) + h;
      sites.add(r.site_id);
    });
    return { totalHours, totalPay, byDay, sites: sites.size, shifts: current.length };
  }, [schedule]);

  // Last 4 weeks delivery
  const recentDelivery = useMemo(() => {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const filt = delivery.filter((d) => d.date && new Date(d.date) >= fourWeeksAgo);
    const total = filt.reduce((s, r) => s + (Number(r.hours_clocked) || 0), 0);
    return { total, count: filt.length };
  }, [delivery]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!c) return <div className="p-6">Cleaner not found.</div>;

  const exportTimesheet = () => {
    downloadXlsx(`${c.cleaner_id}-timesheet.xlsx`, [
      { name: "Cleaner", rows: [c] },
      { name: "Schedule", rows: visible.map(({ pk, version_id, ...r }) => r) },
      { name: "Delivery", rows: delivery.map(({ pk, version_id, ...r }) => r) },
    ]);
  };

  // Compliance items
  const rtwExpiry = c.right_to_work_expiry as string | null;
  let rtwExpired = false, rtwExpiringSoon = false;
  if (rtwExpiry) {
    const days = (new Date(rtwExpiry).getTime() - Date.now()) / 86400000;
    if (days < 0) rtwExpired = true;
    else if (days <= 30) rtwExpiringSoon = true;
  }
  const rtwBase = complianceStatus("RTW", c.right_to_work_on_file);
  const idMissing = !c.id_document_type;
  const compliance = [
    { label: "Right to work", ...rtwBase, expired: rtwBase.expired || rtwExpired, expiringSoon: rtwBase.expiringSoon || rtwExpiringSoon, ok: rtwBase.ok && !rtwExpired, date: rtwExpiry },
    { label: "ID", ok: !idMissing, missing: idMissing, expired: false, expiringSoon: false, raw: c.id_document_type },
    { label: "DBS", ...complianceStatus("DBS", c.dbs_done, c.dbs_date), date: c.dbs_date },
    { label: "Safeguarding", ...complianceStatus("SG", c.safeguarding_done) },
    { label: "PAT (own kit)", ...complianceStatus("PAT", c.pat_test_personal_kit) },
  ];
  const issuesCount = compliance.filter((x) => x.missing || x.expired || x.expiringSoon).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link to="/cleaners" className="text-sm text-muted-foreground hover:underline">← Cleaners</Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name ?? c.cleaner_id}</h1>
            <p className="text-sm text-muted-foreground">
              {c.cleaner_id} · {c.region_primary ?? "—"} · {c.employment_type ?? "—"}
              {parseBool(c.active) === false && <Badge variant="outline" className="ml-2">Inactive</Badge>}
              {parseBool(c.sub_nlw_flag) === true && <Badge variant="destructive" className="ml-2">Sub-NLW</Badge>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={exportTimesheet}>Export Timesheet (Excel)</Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Weekly hours" value={weekly.totalHours.toFixed(1)} sub={`${weekly.shifts} shifts · ${weekly.sites} sites`} />
        {isAdmin && <SummaryCard label="Weekly pay" value={`£${weekly.totalPay.toFixed(2)}`} sub="Scheduled × pay rate" />}
        <SummaryCard label="Last 4 weeks delivered" value={recentDelivery.total.toFixed(1)} sub={`${recentDelivery.count} visits`} />
        <SummaryCard
          label="Compliance"
          value={issuesCount === 0 ? "All OK" : `${issuesCount} to fix`}
          sub={issuesCount === 0 ? "Up to date" : "See compliance card"}
          tone={issuesCount === 0 ? "ok" : "warn"}
        />
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
            <Field label="Starter checklist" v={c.starter_checklist_completed} />
            <Field label="Notes" v={c.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Compliance
              {issuesCount > 0 && <Badge variant="destructive">{issuesCount}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {compliance.map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b last:border-0 pb-1.5 last:pb-0">
                <div className="flex items-center gap-2">
                  {item.expired ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : item.expiringSoon ? (
                    <Clock className="h-4 w-4 text-amber-500" />
                  ) : item.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span>{item.label}</span>
                  {(item as any).date && <span className="text-xs text-muted-foreground">· {(item as any).date}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.expired ? "Expired" : item.expiringSoon ? "Expiring soon" : item.ok ? "OK" : item.raw ? String(item.raw) : "Missing"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Weekly pattern */}
      <Card>
        <CardHeader><CardTitle className="text-base">Weekly pattern</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {DAY_ORDER.map((d) => {
              const h = weekly.byDay[d] ?? 0;
              return (
                <div key={d} className={`rounded-md border p-2 text-center ${h > 0 ? "bg-muted/40" : ""}`}>
                  <div className="text-xs text-muted-foreground">{d}</div>
                  <div className={`mt-1 font-medium ${h > 0 ? "" : "text-muted-foreground"}`}>{h > 0 ? `${h.toFixed(1)}h` : "—"}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
              {delivery.slice(0, 100).map((r) => <TableRow key={r.pk}><TableCell>{r.date}</TableCell><TableCell>{r.site_name}</TableCell><TableCell>{r.hours_clocked}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EntityFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        entity="cleaners"
        idField="cleaner_id"
        title="Edit cleaner"
        fields={CLEANER_FIELDS}
        initial={c}
        isAdmin={isAdmin}
        onSaved={reload}
      />
    </div>
  );
}

function Field({ label, v }: { label: string; v: any }) {
  return <div className="flex gap-2"><span className="w-32 shrink-0 text-muted-foreground">{label}</span><span>{v ?? "—"}</span></div>;
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : ""}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
