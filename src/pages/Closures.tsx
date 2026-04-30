import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPES = ["Bank holiday", "School break", "Site closure", "Other"];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Closure = {
  pk: string;
  closure_id: string;
  date: string | null;
  type: string | null;
  affects: string | null;
  description: string | null;
  version_id: string;
};

export default function Closures() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Closure[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Closure | null>(null);
  const [form, setForm] = useState({ closure_id: "", date: isoDate(new Date()), type: "Bank holiday", affects: "All", description: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Closure | null>(null);

  const todayIso = isoDate(new Date());

  async function load() {
    setLoading(true);
    const [v, c] = await Promise.all([
      supabase.from("data_versions").select("id").eq("is_active", true).maybeSingle(),
      supabase.from("closures").select("*").order("date", { ascending: true }),
    ]);
    setActiveVersion(v.data?.id ?? null);
    setRows((c.data ?? []) as Closure[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ closure_id: `CLS-${Date.now().toString(36).toUpperCase().slice(-6)}`, date: isoDate(new Date()), type: "Bank holiday", affects: "All", description: "" });
    setOpen(true);
  }
  function openEdit(r: Closure) {
    setEditing(r);
    setForm({ closure_id: r.closure_id, date: r.date ?? isoDate(new Date()), type: r.type ?? "Other", affects: r.affects ?? "All", description: r.description ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!activeVersion) { toast({ title: "No active data version", variant: "destructive" }); return; }
    if (!form.closure_id.trim() || !form.date) { toast({ title: "ID and date are required", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      closure_id: form.closure_id.trim(),
      date: form.date,
      type: form.type,
      affects: form.affects.trim() || "All",
      description: form.description.trim() || null,
      version_id: activeVersion,
    };
    const res = editing
      ? await supabase.from("closures").update(payload).eq("pk", editing.pk)
      : await supabase.from("closures").insert(payload);
    setSaving(false);
    if (res.error) { toast({ title: "Save failed", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Closure updated" : "Closure added" });
    setOpen(false);
    load();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    const res = await supabase.from("closures").delete().eq("pk", confirmDelete.pk);
    if (res.error) { toast({ title: "Delete failed", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: "Closure removed" });
    setConfirmDelete(null);
    load();
  }

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
                <TableHead className="w-[90px] text-right">Actions</TableHead>
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
                  <TableRow key={r.pk} className={past ? "opacity-60" : ""}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {r.date ? new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>{r.description ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-normal">{r.type ?? "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{r.affects ?? "All"}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{r.closure_id}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit closure" : "Add closure"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cid">Closure ID</Label>
                <Input id="cid" value={form.closure_id} onChange={(e) => setForm({ ...form, closure_id: e.target.value })} disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdate">Date</Label>
                <Input id="cdate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aff">Affects</Label>
                <Input id="aff" value={form.affects} onChange={(e) => setForm({ ...form, affects: e.target.value })} placeholder="All, All schools, or SITE-xxx, SITE-yyy" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <p className="text-[11px] text-muted-foreground">Use "All" to close every site, "All schools" to suppress school sites, or a comma-separated list of site IDs.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add closure"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this closure?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.description ?? confirmDelete?.closure_id} on {confirmDelete?.date}. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
