import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { downloadXlsx, isCurrent } from "@/lib/exports";
import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff, Lock } from "lucide-react";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseBool(v: any): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function SiteDetail() {
  const { siteId = "" } = useParams();
  const { isAdmin } = useAuth();
  const [site, setSite] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [showHistorical, setShowHistorical] = useState(false);
  const [revealCodes, setRevealCodes] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from("sites_live" as any).select("*").eq("site_id", siteId).maybeSingle();
      setSite(s);
      const { data: sch } = await supabase.from("schedule_live" as any).select("*").eq("site_id", siteId).order("day_of_week");
      const { data: cleanersAll } = await supabase.from("cleaners_live" as any).select("cleaner_id,name");
      const cMap = new Map(((cleanersAll ?? []) as any[]).map((c: any) => [c.cleaner_id, c.name]));
      setSchedule((sch ?? []).map((r: any) => ({ ...r, cleaner_name: cMap.get(r.cleaner_id) ?? r.cleaner_id })));

      const { data: dl } = await supabase
        .from("delivery_log").select("*").eq("site_id", siteId).order("date", { ascending: false }).limit(50);
      setDelivery((dl ?? []).map((r) => ({ ...r, cleaner_name: cMap.get(r.cleaner_id) ?? r.cleaner_id })));

      const { data: cl } = await supabase.from("closures_live" as any).select("*").order("date");
      setClosures(cl ?? []);
      setLoading(false);
    })();
  }, [siteId]);

  const visibleSchedule = useMemo(
    () => (showHistorical ? schedule : schedule.filter((r) => isCurrent(r.effective_to))),
    [schedule, showHistorical]
  );

  // Summary stats
  const summary = useMemo(() => {
    const current = schedule.filter((r) => isCurrent(r.effective_to));
    let totalHours = 0;
    let totalCharge = 0;
    const byDay: Record<string, number> = {};
    const team = new Map<string, { name: string; hours: number; days: Set<string> }>();
    current.forEach((r) => {
      const h = Number(r.duration_hours) || 0;
      totalHours += h;
      const rate = Number(r.billing_rate_override) || Number(site?.billing_rate_default) || 0;
      totalCharge += h * rate;
      const day = (r.day_of_week ?? "").slice(0, 3);
      byDay[day] = (byDay[day] ?? 0) + h;
      const t = team.get(r.cleaner_id) ?? { name: r.cleaner_name, hours: 0, days: new Set<string>() };
      t.hours += h;
      if (day) t.days.add(day);
      team.set(r.cleaner_id, t);
    });
    return { totalHours, totalCharge, byDay, shifts: current.length, team };
  }, [schedule, site]);

  // Upcoming closures (next 60 days, applies to this site)
  const upcomingClosures = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    return closures
      .filter((c) => {
        if (!c.date) return false;
        const d = new Date(c.date);
        if (d < today || d > horizon) return false;
        const a = (c.affects ?? "").toLowerCase();
        if (a === "all" || a === "all schools" || a === "schools") return true;
        return a.split(",").map((x: string) => x.trim()).includes(siteId);
      })
      .slice(0, 8);
  }, [closures, siteId]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!site) return <div className="p-6">Site not found.</div>;

  const exportSchedule = () => {
    downloadXlsx(`${site.site_id}-schedule.xlsx`, [
      { name: "Site", rows: [site] },
      { name: "Schedule", rows: visibleSchedule.map(({ pk, version_id, ...r }) => r) },
    ]);
  };

  // Status flags
  const contractDays = daysUntil(site.contract_end);
  const patDays = daysUntil(site.pat_test_due);
  const hsDays = daysUntil(site.hs_folder_last_updated);

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link to="/sites" className="text-sm text-muted-foreground hover:underline">← Sites</Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{site.client_name ?? site.site_id}</h1>
            <p className="text-sm text-muted-foreground">
              {site.site_id} · {site.region ?? "—"} · {site.postcode ?? ""}
              {parseBool(site.active) === false && <Badge variant="outline" className="ml-2">Inactive</Badge>}
              {parseBool(site.term_time_only) === true && <Badge variant="secondary" className="ml-2">Term-time</Badge>}
            </p>
          </div>
          <Button variant="outline" onClick={exportSchedule}>Export Schedule (Excel)</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Weekly hours" value={summary.totalHours.toFixed(1)} sub={`${summary.shifts} shifts`} />
        <SummaryCard label="Team size" value={String(summary.team.size)} sub={summary.team.size === 0 ? "No cleaner assigned" : "cleaners"} tone={summary.team.size === 0 ? "warn" : undefined} />
        {isAdmin && <SummaryCard label="Weekly charge" value={`£${summary.totalCharge.toFixed(2)}`} sub={site.billing_rate_default ? `@ £${site.billing_rate_default}/h` : "No default rate"} />}
        <SummaryCard
          label="Contract"
          value={contractDays === null ? "—" : contractDays < 0 ? "Ended" : `${contractDays}d`}
          sub={site.contract_end ? `Ends ${site.contract_end}` : "No end date"}
          tone={contractDays !== null && contractDays < 30 ? "warn" : undefined}
        />
      </div>

      {/* Compliance/operational status strip */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-3 text-sm">
          <StatusItem
            label="PAT test"
            date={site.pat_test_due}
            days={patDays}
            okIfFuture
          />
          <StatusItem
            label="H&S folder"
            date={site.hs_folder_last_updated}
            days={hsDays}
            okIfRecent
          />
          <div className="flex items-center gap-2">
            {summary.team.size === 0 ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            <span className="text-muted-foreground">Coverage:</span>
            <span>{summary.team.size === 0 ? "No cleaner assigned" : `${summary.team.size} cleaner${summary.team.size > 1 ? "s" : ""}`}</span>
          </div>
        </CardContent>
      </Card>

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
            <Field label="Products" v={site.products_supplied_by} />
            <Field label="Product notes" v={site.products_notes} />
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
            <Field label="H&S folder updated" v={site.hs_folder_last_updated} />
            <Field label="Notes" v={site.general_notes} />
          </CardContent>
        </Card>
      </div>

      {/* Sensitive: Access codes (admin only, masked by default) */}
      {isAdmin && (site.alarm_info || site.cupboard_codes) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Access codes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setRevealCodes((s) => !s)}>
              {revealCodes ? <><EyeOff className="h-4 w-4 mr-1" /> Hide</> : <><Eye className="h-4 w-4 mr-1" /> Reveal</>}
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Field label="Alarm" v={revealCodes ? site.alarm_info : (site.alarm_info ? "••••••" : "—")} />
            <Field label="Cupboard codes" v={revealCodes ? site.cupboard_codes : (site.cupboard_codes ? "••••••" : "—")} />
          </CardContent>
        </Card>
      )}

      {/* Team at a glance */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cleaning team ({summary.team.size})</CardTitle></CardHeader>
        <CardContent>
          {summary.team.size === 0 ? (
            <div className="text-sm text-muted-foreground">No cleaners currently assigned.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead>Days</TableHead><TableHead>Weekly hours</TableHead></TableRow></TableHeader>
              <TableBody>
                {Array.from(summary.team.entries())
                  .sort((a, b) => b[1].hours - a[1].hours)
                  .map(([id, t]) => (
                    <TableRow key={id}>
                      <TableCell><Link to={`/cleaners/${encodeURIComponent(id)}`} className="hover:underline">{t.name}</Link></TableCell>
                      <TableCell className="text-xs">{DAY_ORDER.filter((d) => t.days.has(d)).join(", ") || "—"}</TableCell>
                      <TableCell>{t.hours.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Weekly pattern */}
      <Card>
        <CardHeader><CardTitle className="text-base">Weekly pattern</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {DAY_ORDER.map((d) => {
              const h = summary.byDay[d] ?? 0;
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
        <CardHeader><CardTitle className="text-base">Upcoming closures (next 60 days)</CardTitle></CardHeader>
        <CardContent>
          {upcomingClosures.length === 0 ? (
            <div className="text-sm text-muted-foreground">No upcoming closures affecting this site.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
              <TableBody>{upcomingClosures.map((c) => <TableRow key={c.pk}><TableCell>{c.date}</TableCell><TableCell>{c.type}</TableCell><TableCell>{c.description}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, v }: { label: string; v: any }) {
  return <div className="flex gap-2"><span className="w-32 shrink-0 text-muted-foreground">{label}</span><span className="break-words">{v ?? "—"}</span></div>;
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

function StatusItem({ label, date, days, okIfFuture, okIfRecent }: { label: string; date?: string | null; days: number | null; okIfFuture?: boolean; okIfRecent?: boolean }) {
  let icon = <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  let text = "Not recorded";
  if (date && days !== null) {
    if (okIfFuture) {
      // due date in the future = ok
      if (days < 0) { icon = <AlertTriangle className="h-4 w-4 text-destructive" />; text = `Overdue (${Math.abs(days)}d)`; }
      else if (days < 30) { icon = <Clock className="h-4 w-4 text-amber-500" />; text = `Due in ${days}d`; }
      else { icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />; text = `${date}`; }
    } else if (okIfRecent) {
      // last updated date — recent = ok (days will be negative)
      const ago = -days;
      if (ago > 365) { icon = <AlertTriangle className="h-4 w-4 text-destructive" />; text = `Updated ${ago}d ago`; }
      else if (ago > 180) { icon = <Clock className="h-4 w-4 text-amber-500" />; text = `Updated ${ago}d ago`; }
      else { icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />; text = `Updated ${date}`; }
    }
  }
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span>{text}</span>
    </div>
  );
}
