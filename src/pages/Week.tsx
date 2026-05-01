import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Clock, Users, Building2 } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
// JS getDay: 0=Sun..6=Sat. Map to our Mon-first index 0..6
const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) {
  const idx = JS_TO_IDX[d.getDay()]; // 0..6 from Mon
  return addDays(d, -idx);
}

export default function Week() {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekIsos = useMemo(() => weekDates.map(isoDate), [weekDates]);
  const startIso = weekIsos[0];
  const endIso = weekIsos[6];

  const [view, setView] = useState<"sites" | "cleaners">("sites");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Map<string, any>>(new Map());
  const [cleaners, setCleaners] = useState<Map<string, any>>(new Map());
  const [schedule, setSchedule] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, c, sch, cl] = await Promise.all([
        supabase.from("sites_live" as any).select("*"),
        supabase.from("cleaners_live" as any).select("*"),
        supabase.from("schedule_live" as any).select("*"),
        supabase.from("closures_live" as any).select("*").gte("date", startIso).lte("date", endIso),
      ]);
      setSites(new Map((s.data ?? []).map((r: any) => [r.site_id, r])));
      setCleaners(new Map((c.data ?? []).map((r: any) => [r.cleaner_id, r])));
      setSchedule(sch.data ?? []);
      setClosures(cl.data ?? []);
      setLoading(false);
    })();
  }, [startIso, endIso]);

  // Closures map: iso -> Set of affected site ids (or "*" for all)
  const closuresByDate = useMemo(() => {
    const map = new Map<string, { all: boolean; ids: Set<string>; rows: any[] }>();
    for (const iso of weekIsos) map.set(iso, { all: false, ids: new Set(), rows: [] });
    for (const c of closures) {
      const entry = map.get(c.date);
      if (!entry) continue;
      entry.rows.push(c);
      const aff = (c.affects ?? "").trim();
      if (!aff || aff.toLowerCase() === "all") entry.all = true;
      else aff.split(/[,;]+/).map((x: string) => x.trim()).filter(Boolean).forEach((id: string) => entry.ids.add(id));
    }
    return map;
  }, [closures, weekIsos]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites.values()) if (s.region) set.add(s.region);
    return Array.from(set).sort();
  }, [sites]);

  // Build: for each (entityId, dayIdx) -> shifts[]
  type Cell = { shifts: any[]; closed: boolean };
  const { siteRows, cleanerRows, totalShifts, totalHours } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySite = new Map<string, Cell[]>();
    const byCleaner = new Map<string, Cell[]>();
    let totalShifts = 0;
    let totalHours = 0;

    const ensure = (m: Map<string, Cell[]>, key: string) => {
      if (!m.has(key)) m.set(key, Array.from({ length: 7 }, () => ({ shifts: [], closed: false })));
      return m.get(key)!;
    };

    for (let i = 0; i < 7; i++) {
      const iso = weekIsos[i];
      const dayName = DAYS[i];
      const cl = closuresByDate.get(iso)!;
      for (const r of schedule) {
        if (r.day_of_week !== dayName) continue;
        if (r.effective_from && r.effective_from > iso) continue;
        if (r.effective_to && r.effective_to < iso) continue;
        const site = sites.get(r.site_id);
        const cleaner = cleaners.get(r.cleaner_id);
        if (region !== "all" && site?.region !== region) continue;
        if (q) {
          const hay = `${site?.client_name ?? ""} ${r.site_id} ${cleaner?.name ?? ""} ${r.cleaner_id}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        const closed = cl.all || cl.ids.has(r.site_id);
        const enriched = { ...r, site, cleaner, closed };
        ensure(bySite, r.site_id)[i].shifts.push(enriched);
        ensure(byCleaner, r.cleaner_id)[i].shifts.push(enriched);
        if (!closed) {
          totalShifts++;
          totalHours += Number(r.duration_hours) || 0;
        }
      }
      // mark closed flag on cells (sites)
      for (const [siteId, cells] of bySite) {
        cells[i].closed = cl.all || cl.ids.has(siteId);
      }
    }

    const siteRows = Array.from(bySite.entries())
      .map(([id, cells]) => ({ id, label: sites.get(id)?.client_name ?? id, sub: `${id} · ${sites.get(id)?.region ?? "—"}`, cells }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const cleanerRows = Array.from(byCleaner.entries())
      .map(([id, cells]) => ({ id, label: cleaners.get(id)?.name ?? id, sub: `${id} · ${cleaners.get(id)?.region_primary ?? "—"}`, cells }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { siteRows, cleanerRows, totalShifts, totalHours };
  }, [schedule, sites, cleaners, weekIsos, closuresByDate, region, search]);

  const rows = view === "sites" ? siteRows : cleanerRows;
  const todayIso = isoDate(new Date());
  const headerLabel = `${weekDates[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${weekDates[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Weekly view</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{headerLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAnchor(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(new Date())}>
              <CalendarDays className="mr-1 h-4 w-4" />This week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAnchor(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={isoDate(weekStart)}
              onChange={(e) => e.target.value && setAnchor(new Date(e.target.value + "T00:00:00"))}
              className="ml-2 h-9 w-[160px] bg-white/95 text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Shifts this week" value={totalShifts} />
        <StatCard icon={Clock} label="Total hours" value={totalHours.toFixed(1)} />
        <StatCard icon={AlertTriangle} label="Closure days" value={Array.from(closuresByDate.values()).filter((c) => c.rows.length > 0).length} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="sites"><Building2 className="mr-1.5 h-3.5 w-3.5" />By site</TabsTrigger>
            <TabsTrigger value="cleaners"><Users className="mr-1.5 h-3.5 w-3.5" />By cleaner</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={view === "sites" ? "Search site or cleaner…" : "Search cleaner or site…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[260px]"
          />
          {view === "sites" && (
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Grid */}
      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 z-10 w-[220px] bg-muted/40 p-3 text-left font-medium">
                    {view === "sites" ? "Site" : "Cleaner"}
                  </th>
                  {weekDates.map((d, i) => {
                    const iso = weekIsos[i];
                    const isToday = iso === todayIso;
                    const cl = closuresByDate.get(iso)!;
                    return (
                      <th key={iso} className={`min-w-[140px] p-3 text-left font-medium ${isToday ? "bg-primary/10 text-primary" : ""}`}>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{DAYS[i].slice(0, 3)}</div>
                        <div className={`text-base ${isToday ? "font-semibold" : ""}`}>{d.getDate()} {d.toLocaleDateString(undefined, { month: "short" })}</div>
                        {cl.all && <Badge variant="outline" className="mt-1 border-warning/50 text-[10px] text-warning-foreground">All closed</Badge>}
                        {!cl.all && cl.rows.length > 0 && <Badge variant="outline" className="mt-1 border-warning/50 text-[10px] text-warning-foreground">{cl.ids.size} closed</Badge>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No shifts this week.</td></tr>
                ) : rows.map((row) => {
                  const weekHours = row.cells.reduce((s, c) => s + c.shifts.reduce((ss: number, sh: any) => ss + (Number(sh.duration_hours) || 0), 0), 0);
                  return (
                    <tr key={row.id} className="border-b align-top hover:bg-muted/20">
                      <td className="sticky left-0 z-10 w-[220px] bg-background p-3">
                        <Link
                          to={view === "sites" ? `/sites/${encodeURIComponent(row.id)}` : `/cleaners/${encodeURIComponent(row.id)}`}
                          className="block font-medium hover:underline"
                        >
                          {row.label}
                        </Link>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{row.sub}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{weekHours.toFixed(1)}h total</div>
                      </td>
                      {row.cells.map((cell, i) => {
                        const iso = weekIsos[i];
                        const isToday = iso === todayIso;
                        return (
                          <td key={iso} className={`min-w-[140px] border-l p-2 ${isToday ? "bg-primary/5" : ""} ${cell.closed ? "bg-warning/5" : ""}`}>
                            {cell.shifts.length === 0 ? (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            ) : (
                              <div className="space-y-1">
                                {cell.closed && (
                                  <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-warning-foreground">
                                    <AlertTriangle className="h-3 w-3" />Closed
                                  </div>
                                )}
                                {cell.shifts
                                  .sort((a: any, b: any) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
                                  .map((sh: any) => (
                                    <div key={sh.pk} className={`text-xs leading-tight ${cell.closed ? "line-through opacity-60" : ""}`}>
                                      <span className="font-medium">
                                        {view === "sites" ? (sh.cleaner?.name ?? sh.cleaner_id) : (sh.site?.client_name ?? sh.site_id)}
                                      </span>
                                      <span className="text-muted-foreground"> · {sh.duration_hours ?? "?"}h</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-md">
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
