import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { OverrideEntity, saveDelete } from "@/lib/overrides";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: OverrideEntity;
  targetId: string;
  label: string;
  onDeleted?: () => void;
}

export default function DeleteOverrideDialog({ open, onOpenChange, entity, targetId, label, onDeleted }: Props) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await saveDelete(entity, targetId, note.trim() || undefined);
      toast({ title: "Removed", description: "Hidden from live data. Admins can revert." });
      onOpenChange(false);
      setNote("");
      onDeleted?.();
    } catch (e: any) {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this record?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{label}</strong> will be hidden from the live view. The original Excel data is preserved and an admin can revert this from the audit page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="delnote" className="text-xs text-muted-foreground">Reason (optional)</Label>
          <Input id="delnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. cleaner left the company" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={go} disabled={busy}>{busy ? "Removing…" : "Remove"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
