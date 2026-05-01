import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";
import EntityFormDialog, { FieldDef } from "@/components/EntityFormDialog";
import DeleteOverrideDialog from "@/components/DeleteOverrideDialog";
import { newEntityId } from "@/lib/overrides";
import { useAuth } from "@/lib/auth";

const TYPES = ["Bank holiday", "School break", "Site closure", "Other"];

const FIELDS: FieldDef[] = [
  { key: "closure_id", label: "ID", required: true, half: true, disabled: false },
  { key: "date", label: "Date", type: "date", required: true, half: true },
  { key: "type", label: "Type", type: "select", options: TYPES, half: true },
  { key: "affects", label: "Affects", placeholder: "All, All schools, or SITE-xxx, SITE-yyy", half: true },
  { key: "description", label: "Description", type: "textarea" },
];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Closure = {
  pk: string; closure_id: string; date: string | null;
  type: string | null; affects: string | null; description: string | null;
  is_overridden?: boolean;
};

export default function Closures() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Closure[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Closure | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Closure | null>(null);

  const todayIso = isoDate(new Date());

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("closures_live" as any).select("*").order("date", { ascending: true });
    setRows(((data ?? []) as unknown) as Closure[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing({
      pk: "", closure_id: newEntityId("CLS"), date: isoDate(new Date()),
      type: "Bank holiday", affects: "All", description: "",
    });
    setOpen(true);
  }
  function openEdit(r: Closure) { setEditing(r); setOpen(true); }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "upcoming" && r.date && r.date < todayIso) return false;
      if (filter === "past" && (!r.date || r.date >= todayIso)) return false;
      if (q) {
        const hay = `${r.closure_id} ${r.type ?? ""} ${r.affects ?? ""} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search, todayIso]);

  // For edits, lock the ID field (can't be changed)
  const editFields: FieldDef[] = editing && editing.pk
    ? FIELDS.map((f) => f.key === "closure_id" ? { ...f, disabled: true } : f)
    : FIELDS;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-6 md:p-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Closures</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Bank holidays, school breaks & site closures</h1>
            <p className="mt-1 text-sm text-primary-foreground/80">Days when scheduled shifts should be suppressed.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Add closure</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>{f}</button>
          ))}
        </div>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" />
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[160px]">Affects</TableHead>
                <TableHead className="w-[110px]">ID</TableHead>
                <TableHead className="w-[110px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="p-8 text-center text-muted-foreground"><CalendarOff className="mx-auto mb-2 h-6 w-6 opacity-40" />No closures.</TableCell></TableRow>
              ) : filtered.map((r) => {
                const past = r.date && r.date < todayIso;
                return (
                  <TableRow key={r.closure_id} className={past ? "opacity-60" : ""}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {r.date ? new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.description ?? <span className="text-muted-foreground">—</span>}
                      {r.is_overridden && <Badge variant="outline" className="ml-2 text-[10px]">edited</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="font-normal">{r.type ?? "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{r.affects ?? "All"}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{r.closure_id}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)} title="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <EntityFormDialog
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
          entity="closures"
          idField="closure_id"
          title={editing.pk ? "Edit closure" : "Add closure"}
          fields={editFields}
          initial={editing}
          isAdmin={isAdmin}
          onSaved={load}
        />
      )}

      {confirmDelete && (
        <DeleteOverrideDialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
          entity="closures"
          targetId={confirmDelete.closure_id}
          label={`${confirmDelete.description ?? confirmDelete.closure_id} on ${confirmDelete.date ?? "—"}`}
          onDeleted={load}
        />
      )}
    </div>
  );
}
