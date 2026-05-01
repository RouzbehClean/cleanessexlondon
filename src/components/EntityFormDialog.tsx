import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { OverrideEntity, saveUpsert } from "@/lib/overrides";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  adminOnly?: boolean;
  half?: boolean; // place in 2-col grid
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: OverrideEntity;
  idField: string;
  title: string;
  fields: FieldDef[];
  initial: Record<string, any>;
  isAdmin: boolean;
  onSaved?: () => void;
}

export default function EntityFormDialog({
  open, onOpenChange, entity, idField, title, fields, initial, isAdmin, onSaved,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>(initial);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initial);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visibleFields = fields.filter((f) => !f.adminOnly || isAdmin);

  async function handleSave() {
    const targetId = String(form[idField] ?? "").trim();
    if (!targetId) {
      toast({ title: `${idField} is required`, variant: "destructive" });
      return;
    }
    for (const f of visibleFields) {
      if (f.required && !String(form[f.key] ?? "").trim()) {
        toast({ title: `${f.label} is required`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      await saveUpsert(entity, targetId, form, note.trim() || undefined);
      toast({ title: "Saved" });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const halfFields = visibleFields.filter((f) => f.half);
  const fullFields = visibleFields.filter((f) => !f.half);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {halfFields.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {halfFields.map((f) => (
                <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
              ))}
            </div>
          )}
          {fullFields.map((f) => (
            <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
          ))}
          <div className="space-y-1.5 border-t pt-3">
            <Label htmlFor="ovnote" className="text-xs text-muted-foreground">Reason for change (optional)</Label>
            <Input id="ovnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. updated phone after site call" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  const v = value ?? "";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.key}>
        {field.label}{field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea id={field.key} value={v} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder} disabled={field.disabled} />
      ) : field.type === "select" ? (
        <Select value={v || undefined} onValueChange={onChange} disabled={field.disabled}>
          <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Select…"} /></SelectTrigger>
          <SelectContent>{(field.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input
          id={field.key}
          type={field.type ?? "text"}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={field.disabled}
        />
      )}
    </div>
  );
}
