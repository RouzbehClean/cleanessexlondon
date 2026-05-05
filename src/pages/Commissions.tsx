import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import CommissionEntryDialog from "@/components/CommissionEntryDialog";
import { CommissionRules, STATUS_LABEL, STATUS_VARIANT, TYPE_LABEL } from "@/lib/commission";
import { useToast } from "@/hooks/use-toast";

export default function Commissions() {
  const { user, isOwnerOrAdmin } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [rules, setRules] = useState<CommissionRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const [e, r] = await Promise.all([
      supabase.from("commission_entries").select("*").eq("staff_user_id", user?.id ?? "").order("created_at", { ascending: false }),
      supabase.from("commission_rules").select("*").limit(1).maybeSingle(),
    ]);
    setEntries(e.data ?? []);
    setRules(r.data as any);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("commission_entries").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    load();
  };

  const total = entries.reduce((s, e) => s + Number(e.override_amount ?? e.calculated_amount ?? 0), 0);
  const approvedTotal = entries.filter(e => ["approved","sent_to_accounts","paid"].includes(e.status))
    .reduce((s, e) => s + Number(e.override_amount ?? e.calculated_amount ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My commissions</h1>
          <p className="text-sm text-muted-foreground">Submit entries for owner review and track their status.</p>
        </div>
        <div className="flex gap-2">
          {isOwnerOrAdmin && (
            <Button variant="outline" asChild><a href="/commissions/review">Review queue</a></Button>
          )}
          <Button onClick={() => { setEditing(null); setDlgOpen(true); }}><Plus className="mr-2 h-4 w-4" />New entry</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Entries</div><div className="text-2xl font-semibold">{entries.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total claimed</div><div className="text-2xl font-semibold">£{total.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Approved</div><div className="text-2xl font-semibold">£{approvedTotal.toFixed(2)}</div></Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client / Job</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No entries yet.</TableCell></TableRow>}
            {entries.map((e) => {
              const editable = ["draft", "rejected"].includes(e.status);
              const amt = Number(e.override_amount ?? e.calculated_amount ?? 0);
              return (
                <TableRow key={e.id}>
                  <TableCell>{e.period_month}</TableCell>
                  <TableCell>{TYPE_LABEL[e.type as keyof typeof TYPE_LABEL]}</TableCell>
                  <TableCell>{e.client_or_job}</TableCell>
                  <TableCell className="text-right font-medium">
                    £{amt.toFixed(2)}
                    {e.override_amount != null && e.override_amount !== e.calculated_amount && (
                      <div className="text-xs text-muted-foreground line-through">£{Number(e.calculated_amount).toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[e.status] ?? "secondary"}>{STATUS_LABEL[e.status]}</Badge>
                    {e.status === "rejected" && e.rejected_reason && (
                      <div className="mt-1 text-xs text-destructive">{e.rejected_reason}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable && rules && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setDlgOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete entry?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(e.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {rules && (
        <CommissionEntryDialog open={dlgOpen} onOpenChange={setDlgOpen} rules={rules} entry={editing} onSaved={load} />
      )}
    </div>
  );
}
