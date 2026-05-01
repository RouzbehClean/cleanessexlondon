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

interface Site {
  pk: string; site_id: string; client_name: string | null; region: string | null;
  postcode: string | null; contract_type: string | null; active: string | null;
  team_grouping: string | null; address?: string | null;
  site_contact_name?: string | null; site_contact_phone?: string | null; site_contact_email?: string | null;
  access_method?: string | null; access_instructions?: string | null;
  alarm_info?: string | null; cupboard_codes?: string | null;
  products_supplied_by?: string | null; products_notes?: string | null;
  billing_rate_default?: number | null; term_time_only?: string | null;
  contract_start?: string | null; contract_end?: string | null;
  pat_test_due?: string | null; hs_folder_last_updated?: string | null;
  general_notes?: string | null;
  is_overridden?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "site_id", label: "Site ID", required: true, half: true },
  { key: "client_name", label: "Client name", required: true, half: true },
  { key: "region", label: "Region", half: true },
  { key: "postcode", label: "Postcode", half: true },
  { key: "address", label: "Address" },
  { key: "site_contact_name", label: "Contact name", half: true },
  { key: "site_contact_phone", label: "Contact phone", half: true },
  { key: "site_contact_email", label: "Contact email", half: true },
  { key: "active", label: "Active", type: "select", options: ["Y", "N"], half: true },
  { key: "contract_type", label: "Contract type", half: true },
  { key: "term_time_only", label: "Term-time only", type: "select", options: ["Y", "N"], half: true },
  { key: "team_grouping", label: "Team grouping", half: true },
  { key: "billing_rate_default", label: "Default billing rate (£/h)", type: "number", half: true, adminOnly: true },
  { key: "contract_start", label: "Contract start", type: "date", half: true },
  { key: "contract_end", label: "Contract end", type: "date", half: true },
  { key: "pat_test_due", label: "PAT test due", type: "date", half: true },
  { key: "hs_folder_last_updated", label: "H&S folder updated", type: "date", half: true },
  { key: "access_method", label: "Access method", half: true },
  { key: "products_supplied_by", label: "Products supplied by", half: true },
  { key: "access_instructions", label: "Access instructions", type: "textarea" },
  { key: "alarm_info", label: "Alarm info", adminOnly: true },
  { key: "cupboard_codes", label: "Cupboard codes", adminOnly: true },
  { key: "products_notes", label: "Product notes", type: "textarea" },
  { key: "general_notes", label: "General notes", type: "textarea" },
];

export default function SitesList() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Site[]>([]);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [contract, setContract] = useState<string>("all");
  const [active, setActive] = useState<string>("Y");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Site | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("sites_live" as any)
      .select("*")
      .order("client_name", { ascending: true });
    setRows(((data ?? []) as unknown) as Site[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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

  function openCreate() {
    setEditing({
      pk: "", site_id: newEntityId("SITE"), client_name: "", region: "", postcode: "",
      contract_type: "", active: "Y", team_grouping: "",
    });
    setOpen(true);
  }
  function openEdit(r: Site) { setEditing(r); setOpen(true); }

  const editFields: FieldDef[] = editing && editing.pk
    ? FIELDS.map((f) => f.key === "site_id" ? { ...f, disabled: true } : f)
    : FIELDS;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} shown</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Add site</Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => downloadXlsx(`sites-${new Date().toISOString().slice(0,10)}.xlsx`, [{ name: "Sites", rows: filtered as unknown as Record<string, unknown>[] }])}>
              Export Excel
            </Button>
          )}
        </div>
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
              <TableHead className="w-[110px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No sites match.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.site_id}>
                <TableCell>
                  <Link to={`/sites/${encodeURIComponent(r.site_id)}`} className="font-medium hover:underline">{r.client_name ?? r.site_id}</Link>
                  {r.is_overridden && <Badge variant="outline" className="ml-2 text-[10px]">edited</Badge>}
                </TableCell>
                <TableCell>{r.region ?? "—"}</TableCell>
                <TableCell>{r.postcode ?? "—"}</TableCell>
                <TableCell>{r.contract_type ?? "—"}</TableCell>
                <TableCell><Badge variant={r.active === "Y" ? "default" : "secondary"}>{r.active ?? "—"}</Badge></TableCell>
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
          entity="sites"
          idField="site_id"
          title={editing.pk ? "Edit site" : "Add site"}
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
          entity="sites"
          targetId={confirmDelete.site_id}
          label={confirmDelete.client_name ?? confirmDelete.site_id}
          onDeleted={load}
        />
      )}
    </div>
  );
}
