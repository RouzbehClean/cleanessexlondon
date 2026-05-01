import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Clock, CheckCircle2, MinusCircle, PlusCircle, HelpCircle, Plus, Pencil, Trash2 } from "lucide-react";
import EntityFormDialog, { FieldDef } from "@/components/EntityFormDialog";
import DeleteOverrideDialog from "@/components/DeleteOverrideDialog";
import { newEntityId } from "@/lib/overrides";

const DELIVERY_FIELDS: FieldDef[] = [
  { key: "delivery_id", label: "Entry ID", required: true, half: true },
  { key: "date", label: "Date", type: "date", required: true, half: true },
  { key: "site_id", label: "Site ID", required: true, half: true },
  { key: "cleaner_id", label: "Cleaner ID", required: true, half: true },
  { key: "hours_clocked", label: "Hours clocked", type: "number", half: true },
  { key: "pay_rate_at_time", label: "Pay rate (£/h)", type: "number", half: true, adminOnly: true },
  { key: "source", label: "Source", placeholder: "e.g. manual, app, paper", half: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { return addDays(d, -JS_TO_IDX[d.getDay()]); }

type Status = "match" | "short" | "over" | "missed" | "unscheduled";

const STATUS_META: Record<Status, { label: string; cls: string; icon: any }> = {
  match: { label: "Match", cls: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  short: { label: "Short", cls: "bg-warning/10 text-warning-foreground border-warning/40", icon: MinusCircle },
  over: { label: "Over", cls: "bg-primary/10 text-primary border-primary/30", icon: PlusCircle },
  missed: { label: "Missed", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  unscheduled: { label: "Unscheduled", cls: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

export default function Delivery() {
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function openCreate() {
    setEditing({ pk: "", delivery_id: newEntityId("DEL"), date: isoDate(new Date()), site_id: "", cleaner_id: "", hours_clocked: 0 });
    setEditOpen(true);
  }
  function openEdit(d: any) { setEditing(d); setEditOpen(true); }

  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekIsos = useMemo(() => weekDates.map(isoDate), [weekDates]);
  const startIso = weekIsos[0];
  const endIso = weekIsos[6];

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Map<string, any>>(new Map());
  const [cleaners, setCleaners] = useState<Map<string, any>>(new Map());
  const [schedule, setSchedule] = useState<any[]>([]);
  const [delivery, setDelivery] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, c, sch, dl, cl] = await Promise.all([
        supabase.from("sites_live" as any).select("*"),
        supabase.from("cleaners_live" as any).select("*"),
        supabase.from("schedule_live" as any).select("*"),
        supabase.from("delivery_live" as any).select("*").gte("date", startIso).lte("date", endIso),
        supabase.from("closures_live" as any).select("*").gte("date", startIso).lte("date", endIso),
      ]);
      setSites(new Map(((s.data ?? []) as any[]).map((r: any) => [r.site_id, r])));
      setCleaners(new Map(((c.data ?? []) as any[]).map((r: any) => [r.cleaner_id, r])));
      setSchedule((sch.data ?? []) as any[]);
      setDelivery((dl.data ?? []) as any[]);
      setClosures((cl.data ?? []) as any[]);
      setLoading(false);
    })();
  }, [startIso, endIso, reloadKey]);

  const closuresByDate = useMemo(() => {
    const map = new Map<string, { all: boolean; ids: Set<string> }>();
    for (const iso of weekIsos) map.set(iso, { all: false, ids: new Set() });
    for (const c of closures) {
      const e = map.get(c.date); if (!e) continue;
      const aff = (c.affects ?? "").trim();
      if (!aff || /^all/i.test(aff)) e.all = true;
      else aff.split(/[,;]+/).map((x: string) => x.trim()).filter(Boolean).forEach((id: string) => e.ids.add(id));
    }
    return map;
  }, [closures, weekIsos]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites.values()) if (s.region) set.add(s.region);
    return Array.from(set).sort();
  }, [sites]);

  // Build comparison rows: one per (date, site, cleaner)
  const rows = useMemo(() => {
    type Row = {
      key: string; date: string; site_id: string; cleaner_id: string;
      scheduled: number; actual: number; status: Status; closed: boolean;
      shifts: any[]; deliveries: any[];
    };
    const map = new Map<string, Row>();
    const keyOf = (date: string, site: string, cleaner: string) => `${date}|${site}|${cleaner}`;

    for (const iso of weekIsos) {
      const cl = closuresByDate.get(iso)!;
      const dayName = DAYS[new Date(iso + "T00:00:00").getDay()];
      for (const r of schedule) {
        if (r.day_of_week !== dayName) continue;
        if (r.effective_from && r.effective_from > iso) continue;
        if (r.effective_to && r.effective_to < iso) continue;
        const closed = cl.all || cl.ids.has(r.site_id);
        const k = keyOf(iso, r.site_id, r.cleaner_id);
        const ex = map.get(k) ?? { key: k, date: iso, site_id: r.site_id, cleaner_id: r.cleaner_id, scheduled: 0, actual: 0, status: "match" as Status, closed, shifts: [], deliveries: [] };
        ex.scheduled += Number(r.duration_hours) || 0;
        ex.shifts.push(r);
        ex.closed = closed;
        map.set(k, ex);
      }
    }
    for (const d of delivery) {
      const k = keyOf(d.date, d.site_id, d.cleaner_id);
      const ex = map.get(k) ?? { key: k, date: d.date, site_id: d.site_id, cleaner_id: d.cleaner_id, scheduled: 0, actual: 0, status: "match" as Status, closed: closuresByDate.get(d.date)?.all || closuresByDate.get(d.date)?.ids.has(d.site_id) || false, shifts: [], deliveries: [] };
      ex.actual += Number(d.hours_clocked) || 0;
      ex.deliveries.push(d);
      map.set(k, ex);
    }

    const TOL = 0.25; // 15 min tolerance
    for (const r of map.values()) {
      if (r.scheduled === 0 && r.actual > 0) r.status = "unscheduled";
      else if (r.actual === 0 && r.scheduled > 0) r.status = r.closed ? "match" : "missed";
      else if (Math.abs(r.actual - r.scheduled) <= TOL) r.status = "match";
      else if (r.actual < r.scheduled) r.status = "short";
      else r.status = "over";
    }

    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((r) => {
        const site = sites.get(r.site_id);
        if (region !== "all" && site?.region !== region) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (q) {
          const hay = `${site?.client_name ?? ""} ${r.site_id} ${cleaners.get(r.cleaner_id)?.name ?? ""} ${r.cleaner_id}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.site_id.localeCompare(b.site_id));
  }, [weekIsos, closuresByDate, schedule, delivery, sites, cleaners, region, search, statusFilter]);

  const totals = useMemo(() => {
    const t = { scheduled: 0, actual: 0, missed: 0, short: 0, over: 0, unscheduled: 0, match: 0 };
    for (const r of rows) {
      t.scheduled += r.scheduled;
      t.actual += r.actual;
      t[r.status]++;
    }
    return t;
  }, [rows]);

  const headerLabel = `${weekDates[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${weekDates[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  const variance = totals.actual - totals.scheduled;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Delivery vs schedule</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{headerLabel}</h1>
            <p className="mt-1 text-sm text-primary-foreground/80">Comparing planned shifts against logged hours.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Log entry</Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(new Date())}><CalendarDays className="mr-1 h-4 w-4" />This week</Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <Input type="date" value={isoDate(weekStart)} onChange={(e) => e.target.value && setAnchor(new Date(e.target.value + "T00:00:00"))} className="ml-2 h-9 w-[160px] bg-white/95 text-foreground" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Clock} label="Scheduled" value={`${totals.scheduled.toFixed(1)}h`} />
        <StatCard icon={Clock} label="Actual" value={`${totals.actual.toFixed(1)}h`} />
        <StatCard icon={variance >= 0 ? PlusCircle : MinusCircle} label="Variance" value={`${variance >= 0 ? "+" : ""}${variance.toFixed(1)}h`} tone={variance < -1 ? "warn" : variance > 1 ? "info" : "ok"} />
        <StatCard icon={AlertTriangle} label="Missed shifts" value={totals.missed} tone={totals.missed > 0 ? "warn" : "ok"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "missed", "short", "over", "unscheduled", "match"] as const).map((s) => {
            const count = s === "all" ? rows.length : (totals as any)[s];
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                {s === "all" ? "All" : STATUS_META[s].label} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search site or cleaner…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Cleaner</TableHead>
                <TableHead className="text-right">Scheduled</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Δ</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="p-8 text-center text-muted-foreground">No records match.</TableCell></TableRow>
              ) : rows.map((r) => {
                const meta = STATUS_META[r.status];
                const Icon = meta.icon;
                const delta = r.actual - r.scheduled;
                const site = sites.get(r.site_id);
                const cleaner = cleaners.get(r.cleaner_id);
                const d = new Date(r.date + "T00:00:00");
                return (
                  <TableRow key={r.key} className="align-top">
                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="font-medium">{d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
                      <div className="text-[11px] text-muted-foreground">{DAYS[d.getDay()].slice(0, 3)}</div>
                      {r.closed && <Badge variant="outline" className="mt-1 border-warning/50 text-[10px] text-warning-foreground">Closed</Badge>}
                    </TableCell>
                    <TableCell>
                      <Link to={`/sites/${encodeURIComponent(r.site_id)}`} className="font-medium hover:underline">{site?.client_name ?? r.site_id}</Link>
                      <div className="text-[11px] text-muted-foreground">{r.site_id}{site?.region ? ` · ${site.region}` : ""}</div>
                    </TableCell>
                    <TableCell>
                      <Link to={`/cleaners/${encodeURIComponent(r.cleaner_id)}`} className="font-medium hover:underline">{cleaner?.name ?? r.cleaner_id}</Link>
                      <div className="text-[11px] text-muted-foreground">{r.cleaner_id}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.scheduled.toFixed(2)}h</TableCell>
                    <TableCell className="text-right tabular-nums">{r.actual.toFixed(2)}h</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${delta < -0.25 ? "text-destructive" : delta > 0.25 ? "text-primary" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(2)}h
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${meta.cls}`}>
                        <Icon className="h-3 w-3" />{meta.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "ok" }: { icon: any; label: string; value: any; tone?: "ok" | "warn" | "info" }) {
  const toneCls = tone === "warn" ? "from-destructive to-destructive/70" : tone === "info" ? "from-primary to-primary/70" : "from-primary to-primary/70";
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${toneCls} text-primary-foreground shadow-md`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
