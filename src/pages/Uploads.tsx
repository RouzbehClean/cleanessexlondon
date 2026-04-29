import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Uploads() {
  const [versions, setVersions] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<any[] | null>(null);

  const refresh = async () => {
    const { data } = await supabase.from("data_versions").select("*").order("uploaded_at", { ascending: false });
    setVersions(data ?? []);
  };
  useEffect(() => { refresh(); }, []);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Pick an .xlsx file");
    setBusy(true); setErrors(null);
    const fd = new FormData();
    fd.append("file", file);
    if (label) fd.append("label", label);
    if (notes) fd.append("notes", notes);
    const { data, error } = await supabase.functions.invoke("upload-version", { body: fd });
    setBusy(false);
    const payload: any = data;
    if (error || payload?.error) {
      if (payload?.validation_errors) { setErrors(payload.validation_errors); toast.error("Upload rejected — see errors below"); }
      else toast.error((error?.message || payload?.error) ?? "Upload failed");
      return;
    }
    toast.success("Uploaded as draft. Activate from the list when ready.");
    setFile(null); setLabel(""); setNotes("");
    refresh();
  };

  const activate = async (id: string) => {
    if (!confirm("Make this version live? Current version will be deactivated.")) return;
    const { data, error } = await supabase.functions.invoke("activate-version", { body: { version_id: id } });
    if (error || (data as any)?.error) return toast.error((error?.message || (data as any)?.error) ?? "Activate failed");
    toast.success("Activated");
    refresh();
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Data uploads</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload new version</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={upload} className="space-y-3">
            <div className="space-y-1"><Label>Excel file (.xlsx)</Label>
              <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1"><Label>Label</Label>
              <Input placeholder="e.g. May 2026 update" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Validating…" : "Upload as draft"}</Button>
            <p className="text-xs text-muted-foreground">Uploads must pass FK validation. Drafts won't go live until you activate them.</p>
          </form>
        </CardContent>
      </Card>

      {errors && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-base text-destructive">Validation errors ({errors.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Sheet</TableHead><TableHead>Row</TableHead><TableHead>Field</TableHead><TableHead>Value</TableHead><TableHead>Problem</TableHead></TableRow></TableHeader>
                <TableBody>
                  {errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.sheet}</TableCell><TableCell>{e.row_index}</TableCell><TableCell>{e.field}</TableCell>
                      <TableCell className="font-mono text-xs">{String(e.value ?? "")}</TableCell><TableCell>{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Versions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Uploaded</TableHead><TableHead>Rows</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell><div className="font-medium">{v.label}</div>{v.notes && <div className="text-xs text-muted-foreground">{v.notes}</div>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(v.uploaded_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">
                    {v.row_counts ? `S:${v.row_counts.sites} C:${v.row_counts.cleaners} Sch:${v.row_counts.schedule} D:${v.row_counts.delivery_log}` : "—"}
                  </TableCell>
                  <TableCell>{v.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Draft</Badge>}</TableCell>
                  <TableCell>{!v.is_active && <Button size="sm" variant="outline" onClick={() => activate(v.id)}>Activate</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
