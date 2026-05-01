import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { downloadXlsx } from "@/lib/exports";

export default function CleanersList() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [active, setActive] = useState("Y");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("cleaners_live" as any)
        .select("pk,cleaner_id,name,region_primary,employment_type,team_id,active,sub_nlw_flag")
        .order("name");
      setRows((data ?? []) as any[]);
      setLoading(false);
    })();
  }, []);

  const regions = useMemo(() => Array.from(new Set(rows.map((r) => r.region_primary).filter(Boolean))), [rows]);
  const filtered = rows.filter((r) => {
    if (active !== "all" && (r.active ?? "") !== active) return false;
    if (region !== "all" && r.region_primary !== region) return false;
    if (q && !`${r.name ?? ""} ${r.cleaner_id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cleaners</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} shown</p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => downloadXlsx(`cleaners-${new Date().toISOString().slice(0,10)}.xlsx`, [{ name: "Cleaners", rows: filtered }])}>
            Export Excel
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All regions</SelectItem>{regions.map((r: any) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={active} onValueChange={setActive}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Y">Active</SelectItem>
            <SelectItem value="N">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Region</TableHead><TableHead>Type</TableHead>
              <TableHead>Team</TableHead><TableHead>Active</TableHead><TableHead>Sub-NLW</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No cleaners match.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.pk}>
                <TableCell><Link to={`/cleaners/${encodeURIComponent(r.cleaner_id)}`} className="font-medium hover:underline">{r.name ?? r.cleaner_id}</Link></TableCell>
                <TableCell>{r.region_primary ?? "—"}</TableCell>
                <TableCell>{r.employment_type ?? "—"}</TableCell>
                <TableCell>{r.team_id ?? "—"}</TableCell>
                <TableCell><Badge variant={r.active === "Y" ? "default" : "secondary"}>{r.active ?? "—"}</Badge></TableCell>
                <TableCell>{r.sub_nlw_flag === "Y" ? <Badge variant="destructive">Yes</Badge> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
