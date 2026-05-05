import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldAlert, CalendarX, UserX, Wrench, FileWarning, Building2 as Building2Outline } from "lucide-react";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}
function monthsAgo(d: string) {
  return (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 30);
}

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<any[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, c, sch, cl] = await Promise.all([
        supabase.from("sites_live" as any).select("*"),
        supabase.from("cleaners_live" as any).select("*"),
        supabase.from("schedule_live" as any).select("*"),
        supabase.from("closures_live" as any).select("*"),
      ]);
      setSites((s.data ?? []) as any[]);
      setCleaners((c.data ?? []) as any[]);
      setSchedule((sch.data ?? []) as any[]);
      setClosures((cl.data ?? []) as any[]);
      setLoading(false);
    })();
  }, []);

  const today = isoDate(new Date());

  // 1. Cleaner compliance issues
  const complianceIssues = useMemo(() => {
    const out: { cleaner: any; issue: string; severity: "high" | "med" }[] = [];
    for (const c of cleaners) {
      if (c.active && c.active.toLowerCase() === "no") continue;
      const rtw = (c.right_to_work_on_file ?? "").toLowerCase();
      if (!rtw || rtw === "no") out.push({ cleaner: c, issue: "Right to Work missing", severity: "high" });
      if (c.right_to_work_expiry) {
        const d = daysBetween(c.right_to_work_expiry, today);
        if (d < 0) out.push({ cleaner: c, issue: `Right to Work expired ${-d}d ago`, severity: "high" });
        else if (d <= 30) out.push({ cleaner: c, issue: `Right to Work expires in ${d}d`, severity: "high" });
      }
      if (!c.id_document_type) out.push({ cleaner: c, issue: "ID document missing", severity: "med" });
      if (!c.starter_checklist_completed || c.starter_checklist_completed.toLowerCase() === "n" || c.starter_checklist_completed.toLowerCase() === "no") {
        out.push({ cleaner: c, issue: "Starter checklist not completed", severity: "med" });
      }
      const dbs = (c.dbs_done ?? "").toLowerCase();
      if (!dbs || dbs === "no") out.push({ cleaner: c, issue: "DBS not on file", severity: "high" });
      else if (c.dbs_date) {
        const m = monthsAgo(c.dbs_date);
        if (m >= 36) out.push({ cleaner: c, issue: `DBS expired (${Math.floor(m)}mo old)`, severity: "high" });
        else if (m >= 30) out.push({ cleaner: c, issue: `DBS expiring soon (${Math.floor(m)}mo old)`, severity: "med" });
      }
      const sg = (c.safeguarding_done ?? "").toLowerCase();
      if (!sg || sg === "no") out.push({ cleaner: c, issue: "Safeguarding not done", severity: "med" });
      const pat = (c.pat_test_personal_kit ?? "").toLowerCase();
      if (pat === "no") out.push({ cleaner: c, issue: "PAT test not done", severity: "med" });
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  }, [cleaners]);

  // 2. Site compliance (PAT, H&S, contracts)
  const siteIssues = useMemo(() => {
    const out: { site: any; issue: string; severity: "high" | "med" }[] = [];
    for (const s of sites) {
      if (s.active && s.active.toLowerCase() === "no") continue;
      if (s.pat_test_due) {
        const d = daysBetween(s.pat_test_due, today);
        if (d < 0) out.push({ site: s, issue: `PAT overdue by ${-d}d`, severity: "high" });
        else if (d <= 30) out.push({ site: s, issue: `PAT due in ${d}d`, severity: "med" });
      }
      if (s.hs_folder_last_updated) {
        const m = monthsAgo(s.hs_folder_last_updated);
        if (m >= 12) out.push({ site: s, issue: `H&S folder ${Math.floor(m)}mo stale`, severity: "med" });
      }
      if (s.contract_end) {
        const d = daysBetween(s.contract_end, today);
        if (d < 0) out.push({ site: s, issue: `Contract ended ${-d}d ago`, severity: "high" });
        else if (d <= 60) out.push({ site: s, issue: `Contract ends in ${d}d`, severity: "med" });
      }
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  }, [sites, today]);

  // 3. Sites with no current schedule
  const unassignedSites = useMemo(() => {
    const scheduled = new Set<string>();
    for (const r of schedule) {
      if (r.effective_to && r.effective_to < today) continue;
      scheduled.add(r.site_id);
    }
    return sites.filter((s) => (!s.active || s.active.toLowerCase() !== "no") && !scheduled.has(s.site_id));
  }, [sites, schedule, today]);

  // 4. Cleaners with no current shifts
  const idleCleaners = useMemo(() => {
    const assigned = new Set<string>();
    for (const r of schedule) {
      if (r.effective_to && r.effective_to < today) continue;
      assigned.add(r.cleaner_id);
    }
    return cleaners.filter((c) => (!c.active || c.active.toLowerCase() !== "no") && !assigned.has(c.cleaner_id));
  }, [cleaners, schedule, today]);

  // 5. Upcoming closure conflicts (next 30 days) — closures that hit scheduled days
  const closureConflicts = useMemo(() => {
    const horizon = isoDate(new Date(Date.now() + 30 * 86400000));
    const upcoming = closures.filter((c) => c.date && c.date >= today && c.date <= horizon);
    const out: { date: string; description: string; affectedShifts: number; sites: string[] }[] = [];
    const DAYNAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const cl of upcoming) {
      const dow = DAYNAMES[new Date(cl.date).getDay()];
      const aff = (cl.affects ?? "").trim().toLowerCase();
      const targetIds = new Set<string>();
      if (!aff || aff === "all") sites.forEach((s) => targetIds.add(s.site_id));
      else if (aff.includes("school")) sites.forEach((s) => { if ((s.contract_type ?? "").toLowerCase().includes("school") || (s.term_time_only ?? "").toLowerCase() === "yes") targetIds.add(s.site_id); });
      else aff.split(/[,;]+/).map((x: string) => x.trim()).forEach((id) => targetIds.add(id));
      const hits = schedule.filter((r) => targetIds.has(r.site_id) && r.day_of_week === dow && (!r.effective_to || r.effective_to >= cl.date));
      const siteSet = new Set<string>(hits.map((h) => h.site_id));
      out.push({ date: cl.date, description: cl.description ?? cl.type ?? "Closure", affectedShifts: hits.length, sites: Array.from(siteSet) });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [closures, schedule, sites, today]);

  const counts = {
    compliance: complianceIssues.length,
    site: siteIssues.length,
    unassigned: unassignedSites.length,
    idle: idleCleaners.length,
    closures: closureConflicts.reduce((n, c) => n + c.affectedShifts, 0),
  };

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">What needs attention right now.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard icon={ShieldAlert} label="Cleaner compliance" value={counts.compliance} tone={counts.compliance > 0 ? "danger" : "ok"} />
        <SummaryCard icon={Wrench} label="Site compliance" value={counts.site} tone={counts.site > 0 ? "warn" : "ok"} />
        <SummaryCard icon={Building2Outline} label="Sites unassigned" value={counts.unassigned} tone={counts.unassigned > 0 ? "warn" : "ok"} />
        <SummaryCard icon={UserX} label="Cleaners idle" value={counts.idle} tone={counts.idle > 0 ? "warn" : "ok"} />
        <SummaryCard icon={CalendarX} label="Shifts in closures" value={counts.closures} tone={counts.closures > 0 ? "warn" : "ok"} />
      </div>

      <Tabs defaultValue="compliance">
        <TabsList>
          <TabsTrigger value="compliance">Compliance ({counts.compliance})</TabsTrigger>
          <TabsTrigger value="sites">Sites ({counts.site})</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned ({counts.unassigned})</TabsTrigger>
          <TabsTrigger value="idle">Idle cleaners ({counts.idle})</TabsTrigger>
          <TabsTrigger value="closures">Closure conflicts ({closureConflicts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compliance">
          <Card><CardContent className="pt-6">
            {loading ? <Empty msg="Loading…" /> : complianceIssues.length === 0 ? <Empty msg="All cleaners compliant 🎉" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead>Issue</TableHead><TableHead>Severity</TableHead></TableRow></TableHeader>
                <TableBody>
                  {complianceIssues.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Link className="text-primary hover:underline" to={`/cleaners/${r.cleaner.cleaner_id}`}>{r.cleaner.name ?? r.cleaner.cleaner_id}</Link></TableCell>
                      <TableCell>{r.issue}</TableCell>
                      <TableCell><Badge variant={r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="sites">
          <Card><CardContent className="pt-6">
            {loading ? <Empty msg="Loading…" /> : siteIssues.length === 0 ? <Empty msg="All sites in good shape" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Region</TableHead><TableHead>Issue</TableHead><TableHead>Severity</TableHead></TableRow></TableHeader>
                <TableBody>
                  {siteIssues.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Link className="text-primary hover:underline" to={`/sites/${r.site.site_id}`}>{r.site.client_name ?? r.site.site_id}</Link></TableCell>
                      <TableCell className="text-muted-foreground">{r.site.region ?? "—"}</TableCell>
                      <TableCell>{r.issue}</TableCell>
                      <TableCell><Badge variant={r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="unassigned">
          <Card><CardContent className="pt-6">
            {loading ? <Empty msg="Loading…" /> : unassignedSites.length === 0 ? <Empty msg="Every active site has a cleaner" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Region</TableHead><TableHead>Contract</TableHead></TableRow></TableHeader>
                <TableBody>
                  {unassignedSites.map((s) => (
                    <TableRow key={s.site_id}>
                      <TableCell><Link className="text-primary hover:underline" to={`/sites/${s.site_id}`}>{s.client_name ?? s.site_id}</Link></TableCell>
                      <TableCell className="text-muted-foreground">{s.region ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.contract_type ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="idle">
          <Card><CardContent className="pt-6">
            {loading ? <Empty msg="Loading…" /> : idleCleaners.length === 0 ? <Empty msg="All active cleaners have shifts" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead>Region</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {idleCleaners.map((c) => (
                    <TableRow key={c.cleaner_id}>
                      <TableCell><Link className="text-primary hover:underline" to={`/cleaners/${c.cleaner_id}`}>{c.name ?? c.cleaner_id}</Link></TableCell>
                      <TableCell className="text-muted-foreground">{c.region_primary ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.employment_type ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="closures">
          <Card><CardContent className="pt-6">
            {loading ? <Empty msg="Loading…" /> : closureConflicts.length === 0 ? <Empty msg="No upcoming closures" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Closure</TableHead><TableHead>Sites affected</TableHead><TableHead>Shifts impacted</TableHead></TableRow></TableHeader>
                <TableBody>
                  {closureConflicts.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.date}</TableCell>
                      <TableCell>{c.description}</TableCell>
                      <TableCell className="text-muted-foreground">{c.sites.length}</TableCell>
                      <TableCell>{c.affectedShifts > 0 ? <Badge variant="secondary">{c.affectedShifts}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "ok" | "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning-foreground" : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className={`h-5 w-5 ${cls}`} />
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{msg}</div>;
}

