import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Clock, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function prettyDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function Today() {
  const { isAdmin } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [sites, setSites] = useState<Map<string, any>>(new Map());
  const [cleaners, setCleaners] = useState<Map<string, any>>(new Map());
  const [closures, setClosures] = useState<any[]>([]);
  const [region, setRegion] = useState<string>("all");
  const [search, setSearch] = useState("");

  const dayName = DAYS[date.getDay()];
  const iso = isoDate(date);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, c, sch, cl] = await Promise.all([
        supabase.from("sites_live" as any).select("*"),
        supabase.from("cleaners_live" as any).select("*"),
        supabase.from("schedule_live" as any).select("*").eq("day_of_week", dayName),
        supabase.from("closures_live" as any).select("*").eq("date", iso),
      ]);
      setSites(new Map(((s.data ?? []) as any[]).map((r: any) => [r.site_id, r])));
      setCleaners(new Map(((c.data ?? []) as any[]).map((r: any) => [r.cleaner_id, r])));
      setSchedule((sch.data ?? []) as any[]);
      setClosures((cl.data ?? []) as any[]);
      setLoading(false);
    })();
  }, [iso, dayName]);

  // Filter schedule: effective range covers today
  const activeShifts = useMemo(() => {
    return schedule
      .filter((r) => {
        if (r.effective_from && r.effective_from > iso) return false;
        if (r.effective_to && r.effective_to < iso) return false;
        return true;
      })
      .map((r) => ({
        ...r,
        site: sites.get(r.site_id),
        cleaner: cleaners.get(r.cleaner_id),
      }));
  }, [schedule, sites, cleaners, iso]);

  const closedSiteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of closures) {
      const aff = (c.affects ?? "").trim();
      if (!aff || aff.toLowerCase() === "all") {
        for (const id of sites.keys()) ids.add(id);
      } else {
        // affects could be a site_id or comma list
        aff.split(/[,;]+/).map((x: string) => x.trim()).filter(Boolean).forEach((id: string) => ids.add(id));
      }
    }
    return ids;
  }, [closures, sites]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites.values()) if (s.region) set.add(s.region);
    return Array.from(set).sort();
  }, [sites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeShifts.filter((r) => {
      if (region !== "all" && r.site?.region !== region) return false;
      if (q) {
        const hay = `${r.site?.client_name ?? ""} ${r.site_id} ${r.cleaner?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeShifts, region, search]);

  // Group by site
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of filtered) {
      if (!map.has(r.site_id)) map.set(r.site_id, []);
      map.get(r.site_id)!.push(r);
    }
    // sort: closed sites first, then by client name
    return Array.from(map.entries())
      .map(([siteId, rows]) => ({
        siteId,
        site: sites.get(siteId),
        rows: rows.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
        closed: closedSiteIds.has(siteId),
      }))
      .sort((a, b) => {
        if (a.closed !== b.closed) return a.closed ? -1 : 1;
        return (a.site?.client_name ?? a.siteId).localeCompare(b.site?.client_name ?? b.siteId);
      });
  }, [filtered, sites, closedSiteIds]);

  const totalHours = filtered.reduce((s, r) => s + (Number(r.duration_hours) || 0), 0);
  const uniqueCleaners = new Set(filtered.map((r) => r.cleaner_id)).size;

  const isToday = iso === isoDate(new Date());

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
              {isToday ? "Today's schedule" : "Schedule"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{prettyDate(date)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDate(new Date())}>
              <CalendarDays className="mr-1 h-4 w-4" />Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={iso}
              onChange={(e) => e.target.value && setDate(new Date(e.target.value + "T00:00:00"))}
              className="ml-2 h-9 w-[160px] bg-white/95 text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Closures banner */}
      {closures.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {closures.length} closure{closures.length > 1 ? "s" : ""} on this day
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {closures.map((c) => (
              <div key={c.pk} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-warning/40 text-warning-foreground">{c.type ?? "closure"}</Badge>
                <span className="font-medium">{c.affects ?? "All sites"}</span>
                {c.description && <span className="text-muted-foreground">— {c.description}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Shifts scheduled" value={filtered.length} />
        <StatCard icon={Users} label="Cleaners on duty" value={uniqueCleaners} />
        <StatCard icon={Clock} label="Total hours" value={totalHours.toFixed(1)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search site or cleaner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grouped list */}
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No shifts scheduled for this day.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <Card key={g.siteId} className={g.closed ? "border-warning/50 bg-warning/5" : "border-border/60 shadow-soft"}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">
                    <Link to={`/sites/${encodeURIComponent(g.siteId)}`} className="hover:underline">
                      {g.site?.client_name ?? g.siteId}
                    </Link>
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {g.siteId} · {g.site?.region ?? "—"} {g.site?.postcode ? `· ${g.site.postcode}` : ""}
                  </p>
                </div>
                {g.closed && (
                  <Badge variant="outline" className="border-warning/50 text-warning-foreground">
                    <AlertTriangle className="mr-1 h-3 w-3" />Site closed
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Start</TableHead>
                      <TableHead>Cleaner</TableHead>
                      <TableHead className="w-[80px]">Hours</TableHead>
                      <TableHead>Role</TableHead>
                      {isAdmin && <TableHead className="w-[90px]">Pay</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((r) => (
                      <TableRow key={r.pk}>
                        <TableCell className="font-mono text-xs">{r.start_time ?? "—"}</TableCell>
                        <TableCell>
                          <Link to={`/cleaners/${encodeURIComponent(r.cleaner_id)}`} className="hover:underline">
                            {r.cleaner?.name ?? r.cleaner_id}
                          </Link>
                        </TableCell>
                        <TableCell>{r.duration_hours ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.shift_role ?? "—"}</TableCell>
                        {isAdmin && <TableCell>{r.pay_rate ? `£${r.pay_rate}` : "—"}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
