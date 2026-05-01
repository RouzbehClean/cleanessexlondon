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
import { Plus, Pencil, Trash2 } from "lucide-react";
import EntityFormDialog, { FieldDef } from "@/components/EntityFormDialog";
import DeleteOverrideDialog from "@/components/DeleteOverrideDialog";
import { newEntityId } from "@/lib/overrides";

const FIELDS: FieldDef[] = [
  { key: "cleaner_id", label: "Cleaner ID", required: true, half: true },
  { key: "name", label: "Name", required: true, half: true },
  { key: "phone", label: "Phone", half: true },
  { key: "email", label: "Email", half: true },
  { key: "region_primary", label: "Primary region", half: true },
  { key: "team_id", label: "Team", half: true },
  { key: "employment_type", label: "Employment type", type: "select", options: ["Employee", "Self-employed", "Agency"], half: true },
  { key: "active", label: "Active", type: "select", options: ["Y", "N"], half: true },
  { key: "sub_nlw_flag", label: "Sub-NLW", type: "select", options: ["Y", "N"], half: true, adminOnly: true },
  { key: "right_to_work_on_file", label: "Right to work on file", type: "select", options: ["Y", "N"], half: true },
  { key: "dbs_done", label: "DBS done", type: "select", options: ["Y", "N"], half: true },
  { key: "dbs_date", label: "DBS date", type: "date", half: true },
  { key: "safeguarding_done", label: "Safeguarding done", type: "select", options: ["Y", "N"], half: true },
  { key: "pat_test_personal_kit", label: "PAT (own kit)", type: "select", options: ["Y", "N"], half: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

export default function CleanersList() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [active, setActive] = useState("Y");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("cleaners_live" as any).select("*").order("name");
    setRows((data ?? []) as any[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const regions = useMemo(() => Array.from(new Set(rows.map((r) => r.region_primary).filter(Boolean))), [rows]);
  const filtered = rows.filter((r) => {
    if (active !== "all" && (r.active ?? "") !== active) return false;
    if (region !== "all" && r.region_primary !== region) return false;
    if (q && !`${r.name ?? ""} ${r.cleaner_id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function openCreate() {
    setEditing({ pk: "", cleaner_id: newEntityId("CLN"), name: "", region_primary: "", active: "Y", employment_type: "Employee" });
    setOpen(true);
  }
  function openEdit(r: any) { setEditing(r); setOpen(true); }

  const editFields: FieldDef[] = editing && editing.pk
    ? FIELDS.map((f) => f.key === "cleaner_id" ? { ...f, disabled: true } : f)
    : FIELDS;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cleaners</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} shown</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Add cleaner</Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => downloadXlsx(`cleaners-${new Date().toISOString().slice(0,10)}.xlsx`, [{ name: "Cleaners", rows: filtered }])}>
              Export Excel
            </Button>
          )}
        </div>
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
              <TableHead className="w-[110px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No cleaners match.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.cleaner_id}>
                <TableCell>
                  <Link to={`/cleaners/${encodeURIComponent(r.cleaner_id)}`} className="font-medium hover:underline">{r.name ?? r.cleaner_id}</Link>
                  {r.is_overridden && <Badge variant="outline" className="ml-2 text-[10px]">edited</Badge>}
                </TableCell>
                <TableCell>{r.region_primary ?? "—"}</TableCell>
                <TableCell>{r.employment_type ?? "—"}</TableCell>
                <TableCell>{r.team_id ?? "—"}</TableCell>
                <TableCell><Badge variant={r.active === "Y" ? "default" : "secondary"}>{r.active ?? "—"}</Badge></TableCell>
                <TableCell>{r.sub_nlw_flag === "Y" ? <Badge variant="destructive">Yes</Badge> : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)} title="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EntityFormDialog
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
          entity="cleaners"
          idField="cleaner_id"
          title={editing.pk ? "Edit cleaner" : "Add cleaner"}
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
          entity="cleaners"
          targetId={confirmDelete.cleaner_id}
          label={confirmDelete.name ?? confirmDelete.cleaner_id}
          onDeleted={load}
        />
      )}
    </div>
  );
}
