import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { History, Undo2 } from "lucide-react";
import { OverrideEntity, entityConfig, revertOverride } from "@/lib/overrides";

type Row = {
  id: string;
  entity: OverrideEntity;
  op: "upsert" | "delete";
  target_id: string;
  payload: any;
  note: string | null;
  edited_by: string | null;
  edited_at: string;
  is_active: boolean;
  reverted_by: string | null;
  reverted_at: string | null;
  editor_email?: string;
};

const ENTITIES: OverrideEntity[] = ["sites", "cleaners", "schedule", "delivery", "closures"];

export default function Overrides() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "reverted" | "all">("active");
  const [entityFilter, setEntityFilter] = useState<"all" | OverrideEntity>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const all: Row[] = [];
    for (const ent of ENTITIES) {
      const cfg = entityConfig(ent);
      const { data, error } = await supabase
        .from(cfg.overridesTable as any)
        .select("*")
        .order("edited_at", { ascending: false })
        .limit(500);
      if (error) continue;
      for (const r of (data ?? []) as any[]) {
        all.push({
          id: r.id,
          entity: ent,
          op: r.op,
          target_id: r[cfg.idField],
          payload: r.payload,
          note: r.note,
          edited_by: r.edited_by,
          edited_at: r.edited_at,
          is_active: r.is_active,
          reverted_by: r.reverted_by,
          reverted_at: r.reverted_at,
        });
      }
    }
    // Resolve editor emails from profiles
    const userIds = Array.from(new Set(all.map((r) => r.edited_by).filter(Boolean) as string[]));
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,email,display_name").in("id", userIds);
      const emap = new Map((profs ?? []).map((p: any) => [p.id, p.display_name || p.email]));
      all.forEach((r) => { if (r.edited_by) r.editor_email = emap.get(r.edited_by) as string; });
    }
    all.sort((a, b) => b.edited_at.localeCompare(a.edited_at));
    setRows(all);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "active" && !r.is_active) return false;
      if (filter === "reverted" && r.is_active) return false;
      if (entityFilter !== "all" && r.entity !== entityFilter) return false;
      if (q) {
        const hay = `${r.target_id} ${r.note ?? ""} ${r.editor_email ?? ""} ${JSON.stringify(r.payload ?? {})}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, entityFilter, search]);

  const counts = useMemo(() => ({
    active: rows.filter((r) => r.is_active).length,
    reverted: rows.filter((r) => !r.is_active).length,
    total: rows.length,
  }), [rows]);

  async function handleRevert(r: Row) {
    setBusyId(r.id);
    try {
      await revertOverride(r.entity, r.id);
      toast({ title: "Reverted", description: `${r.entity} ${r.target_id} restored to uploaded data.` });
      await load();
    } catch (e: any) {
      toast({ title: "Revert failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  function summarize(r: Row) {
    if (r.op === "delete") return <span className="text-destructive">Removed</span>;
    if (!r.payload) return <span className="text-muted-foreground">—</span>;
    const keys = Object.keys(r.payload).filter((k) => !["site_id","cleaner_id","schedule_id","delivery_id","closure_id","pk","version_id"].includes(k));
    return <span className="text-xs text-muted-foreground">{keys.slice(0, 4).join(", ")}{keys.length > 4 ? "…" : ""}</span>;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Audit</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <History className="h-6 w-6" /> Staff edits
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            All add / edit / delete overrides on top of the uploaded Excel data. Revert any to restore the original.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="active">Active <span className="ml-1.5 opacity-60">{counts.active}</span></TabsTrigger>
            <TabsTrigger value="reverted">Reverted <span className="ml-1.5 opacity-60">{counts.reverted}</span></TabsTrigger>
            <TabsTrigger value="all">All <span className="ml-1.5 opacity-60">{counts.total}</span></TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {(["all", ...ENTITIES] as const).map((e) => (
            <button key={e} onClick={() => setEntityFilter(e as any)} className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${entityFilter === e ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
              {e}
            </button>
          ))}
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[220px]" />
        </div>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">When</TableHead>
                <TableHead className="w-[100px]">Entity</TableHead>
                <TableHead className="w-[100px]">Op</TableHead>
                <TableHead className="w-[160px]">Target</TableHead>
                <TableHead>Changed</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-[140px]">Editor</TableHead>
                <TableHead className="w-[110px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="p-8 text-center text-muted-foreground">No overrides match.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className={r.is_active ? "" : "opacity-60"}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.edited_at).toLocaleString()}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.entity}</Badge></TableCell>
                  <TableCell>
                    {r.op === "delete"
                      ? <Badge variant="destructive">delete</Badge>
                      : <Badge variant="outline">upsert</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">{r.target_id}</TableCell>
                  <TableCell>{summarize(r)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.note ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.editor_email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.is_active ? (
                      <Button variant="ghost" size="sm" disabled={busyId === r.id} onClick={() => handleRevert(r)}>
                        <Undo2 className="mr-1 h-3.5 w-3.5" />Revert
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">reverted</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
