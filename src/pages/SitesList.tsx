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

interface Site {
  pk: string; site_id: string; client_name: string | null; region: string | null;
  postcode: string | null; contract_type: string | null; active: string | null;
  team_grouping: string | null;
}

export default function SitesList() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Site[]>([]);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [contract, setContract] = useState<string>("all");
  const [active, setActive] = useState<string>("Y");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sites_safe")
        .select("pk,site_id,client_name,region,postcode,contract_type,active,team_grouping")
        .order("client_name", { ascending: true });
      setRows((data ?? []) as Site[]);
      setLoading(false);
    })();
  }, []);

  const regions = useMemo(() => Array.from(new Set(rows.map((r) => r.region).filter(Boolean))) as string[], [rows]);
  const contracts = useMemo(() => Array.from(new Set(rows.map((r) => r.contract_type).filter(Boolean))) as string[], [rows]);

  const filtered = rows.filter((r) => {
    if (active !== "all" && (r.active ?? "") !== active) return false;
    if (region !== "all" && r.region !== region) return false;
    if (contract !== "all" && r.contract_type !== contract) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!`${r.client_name ?? ""} ${r.site_id} ${r.postcode ?? ""}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} shown</p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => downloadXlsx(`sites-${new Date().toISOString().slice(0,10)}.xlsx`, [{ name: "Sites", rows: filtered as unknown as Record<string, unknown>[] }])}>
            Export Excel
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by name, postcode, ID…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All regions</SelectItem>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={contract} onValueChange={setContract}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Contract" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All contracts</SelectItem>{contracts.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
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
              <TableHead>Client</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No sites match.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.pk} className="cursor-pointer">
                <TableCell><Link to={`/sites/${encodeURIComponent(r.site_id)}`} className="font-medium hover:underline">{r.client_name ?? r.site_id}</Link></TableCell>
                <TableCell>{r.region ?? "—"}</TableCell>
                <TableCell>{r.postcode ?? "—"}</TableCell>
                <TableCell>{r.contract_type ?? "—"}</TableCell>
                <TableCell><Badge variant={r.active === "Y" ? "default" : "secondary"}>{r.active ?? "—"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
