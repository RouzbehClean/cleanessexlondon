import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { downloadXlsx } from "@/lib/exports";
import { useAuth } from "@/lib/auth";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { return addDays(d, -JS_TO_IDX[d.getDay()]); }

export default function Reports() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState<string>(isoDate(startOfWeek(new Date())));
  const [to, setTo] = useState<string>(isoDate(addDays(startOfWeek(new Date()), 6)));
  const [region, setRegion] = useState("all");

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Map<string, any>>(new Map());
  const [cleaners, setCleaners] = useState<Map<string, any>>(new Map());
  const [schedule, setSchedule] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, c, sch, dl, cl] = await Promise.all([
        supabase.from("sites_live" as any).select("*"),
        supabase.from("cleaners_live" as any).select("*"),
        supabase.from("schedule_live" as any).select("*"),
        supabase.from("delivery_live" as any).select("*").gte("date", from).lte("date", to),
        supabase.from("closures_live" as any).select("*").gte("date", from).lte("date", to),
      ]);
      setSites(new Map((s.data ?? []).map((r: any) => [r.site_id, r])));
      setCleaners(new Map((c.data ?? []).map((r: any) => [r.cleaner_id, r])));
      setSchedule(sch.data ?? []);
      setDelivery(dl.data ?? []);
      setClosures(cl.data ?? []);
      setLoading(false);
    })();
  }, [from, to]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites.values()) if (s.region) set.add(s.region);
    return Array.from(set).sort();
  }, [sites]);

  // Build scheduled occurrences in range
  const scheduledOccurrences = useMemo(() => {
    const out: { date: string; site_id: string; cleaner_id: string; hours: number; pay_rate: number; billing_rate: number }[] = [];
    if (!from || !to) return out;
    const start = new Date(from);
    const end = new Date(to);
    const closedDates = new Map<string, { all: boolean; ids: Set<string> }>();
    for (const cl of closures) {
      const e = closedDates.get(cl.date) ?? { all: false, ids: new Set<string>() };
      const aff = (cl.affects ?? "").trim().toLowerCase();
      if (!aff || aff === "all") e.all = true;
      else aff.split(/[,;]+/).map((x: string) => x.trim()).forEach((id: string) => e.ids.add(id));
      closedDates.set(cl.date, e);
    }
    const DAYNAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const iso = isoDate(d);
      const dow = DAYNAMES[d.getDay()];
      const closure = closedDates.get(iso);
      for (const r of schedule) {
        if (r.day_of_week !== dow) continue;
        if (r.effective_from && r.effective_from > iso) continue;
        if (r.effective_to && r.effective_to < iso) continue;
        if (closure?.all || closure?.ids.has(r.site_id)) continue;
        const site = sites.get(r.site_id);
        out.push({
          date: iso,
          site_id: r.site_id,
          cleaner_id: r.cleaner_id,
          hours: Number(r.duration_hours ?? 0),
          pay_rate: Number(r.pay_rate ?? 0),
          billing_rate: Number(r.billing_rate_override ?? site?.billing_rate_default ?? 0),
        });
      }
    }
    return out;
  }, [schedule, sites, closures, from, to]);

  const inRegion = (siteId: string) => {
    if (region === "all") return true;
    return (sites.get(siteId)?.region ?? "") === region;
  };

  // Cleaner hours summary
  const cleanerHours = useMemo(() => {
    const map = new Map<string, { scheduled: number; actual: number; pay: number }>();
    for (const o of scheduledOccurrences) {
      if (!inRegion(o.site_id)) continue;
      const e = map.get(o.cleaner_id) ?? { scheduled: 0, actual: 0, pay: 0 };
      e.scheduled += o.hours;
      map.set(o.cleaner_id, e);
    }
    for (const d of delivery) {
      if (!inRegion(d.site_id)) continue;
      const e = map.get(d.cleaner_id) ?? { scheduled: 0, actual: 0, pay: 0 };
      e.actual += Number(d.hours_clocked ?? 0);
      e.pay += Number(d.hours_clocked ?? 0) * Number(d.pay_rate_at_time ?? 0);
      map.set(d.cleaner_id, e);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: cleaners.get(id)?.name ?? id, ...v, variance: v.actual - v.scheduled }))
      .sort((a, b) => b.actual - a.actual);
  }, [scheduledOccurrences, delivery, cleaners, region, sites]);

  // Site billable summary
  const siteBilling = useMemo(() => {
    const map = new Map<string, { scheduled: number; actual: number; billable: number }>();
    for (const o of scheduledOccurrences) {
      if (!inRegion(o.site_id)) continue;
      const e = map.get(o.site_id) ?? { scheduled: 0, actual: 0, billable: 0 };
      e.scheduled += o.hours;
      e.billable += o.hours * o.billing_rate;
      map.set(o.site_id, e);
    }
    for (const d of delivery) {
      if (!inRegion(d.site_id)) continue;
      const e = map.get(d.site_id) ?? { scheduled: 0, actual: 0, billable: 0 };
      e.actual += Number(d.hours_clocked ?? 0);
      map.set(d.site_id, e);
    }
    return Array.from(map.entries())
      .map(([id, v]) => {
        const site = sites.get(id);
        return { id, name: site?.client_name ?? id, region: site?.region ?? "—", ...v };
      })
      .sort((a, b) => b.billable - a.billable);
  }, [scheduledOccurrences, delivery, sites, region]);

  const totals = useMemo(() => ({
    scheduled: cleanerHours.reduce((n, r) => n + r.scheduled, 0),
    actual: cleanerHours.reduce((n, r) => n + r.actual, 0),
    pay: cleanerHours.reduce((n, r) => n + r.pay, 0),
    billable: siteBilling.reduce((n, r) => n + r.billable, 0),
  }), [cleanerHours, siteBilling]);

  const exportPayRun = () => {
    const rows = cleanerHours.map((r) => {
      const c = cleaners.get(r.id);
      return {
        cleaner_id: r.id,
        name: r.name,
        email: c?.email ?? "",
        employment_type: c?.employment_type ?? "",
        scheduled_hours: r.scheduled.toFixed(2),
        actual_hours: r.actual.toFixed(2),
        variance_hours: r.variance.toFixed(2),
        gross_pay: r.pay.toFixed(2),
      };
    });
    downloadXlsx(`pay-run_${from}_to_${to}.xlsx`, [{ name: "Pay Run", rows }]);
  };

  const exportSiteBilling = () => {
    const rows = siteBilling.map((r) => ({
      site_id: r.id,
      client_name: r.name,
      region: r.region,
      scheduled_hours: r.scheduled.toFixed(2),
      actual_hours: r.actual.toFixed(2),
      billable_amount: r.billable.toFixed(2),
    }));
    downloadXlsx(`site-billing_${from}_to_${to}.xlsx`, [{ name: "Site Billing", rows }]);
  };

  const exportDeliveryLog = () => {
    const rows = delivery
      .filter((d) => inRegion(d.site_id))
      .map((d) => ({
        date: d.date,
        site_id: d.site_id,
        site_name: sites.get(d.site_id)?.client_name ?? "",
        cleaner_id: d.cleaner_id,
        cleaner_name: cleaners.get(d.cleaner_id)?.name ?? "",
        hours_clocked: d.hours_clocked,
        pay_rate: d.pay_rate_at_time,
        gross: (Number(d.hours_clocked ?? 0) * Number(d.pay_rate_at_time ?? 0)).toFixed(2),
        source: d.source ?? "",
        notes: d.notes ?? "",
      }));
    downloadXlsx(`delivery-log_${from}_to_${to}.xlsx`, [{ name: "Delivery Log", rows }]);
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Hours, pay, and billing across any date range.</p>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {isAdmin && <Button variant="outline" onClick={exportPayRun}><Download className="mr-2 h-4 w-4" />Pay run</Button>}
            <Button variant="outline" onClick={exportSiteBilling}><Download className="mr-2 h-4 w-4" />Site billing</Button>
            <Button variant="outline" onClick={exportDeliveryLog}><Download className="mr-2 h-4 w-4" />Delivery log</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Scheduled hrs" value={totals.scheduled.toFixed(1)} />
        <Stat label="Actual hrs" value={totals.actual.toFixed(1)} />
        {isAdmin && <Stat label="Gross pay" value={`£${totals.pay.toFixed(2)}`} />}
        <Stat label="Billable" value={`£${totals.billable.toFixed(2)}`} />
      </div>

      <Tabs defaultValue="cleaners">
        <TabsList>
          <TabsTrigger value="cleaners">Cleaner hours</TabsTrigger>
          <TabsTrigger value="sites">Site billing</TabsTrigger>
        </TabsList>

        <TabsContent value="cleaners">
          <Card><CardContent className="pt-6">
            {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : cleanerHours.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Cleaner</TableHead>
                  <TableHead className="text-right">Scheduled</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  {isAdmin && <TableHead className="text-right">Gross pay</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {cleanerHours.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.scheduled.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.actual.toFixed(2)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${Math.abs(r.variance) < 0.25 ? "text-muted-foreground" : r.variance < 0 ? "text-destructive" : "text-primary"}`}>{r.variance >= 0 ? "+" : ""}{r.variance.toFixed(2)}</TableCell>
                      {isAdmin && <TableCell className="text-right tabular-nums">£{r.pay.toFixed(2)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="sites">
          <Card><CardContent className="pt-6">
            {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : siteBilling.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Scheduled hrs</TableHead>
                  <TableHead className="text-right">Actual hrs</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {siteBilling.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.region}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.scheduled.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.actual.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">£{r.billable.toFixed(2)}</TableCell>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
