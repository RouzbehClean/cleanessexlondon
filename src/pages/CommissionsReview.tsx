import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Edit3, Send, Banknote, RotateCcw, AlertTriangle } from "lucide-react";
import { STATUS_LABEL, STATUS_VARIANT, TYPE_LABEL } from "@/lib/commission";
import { useToast } from "@/hooks/use-toast";

type Action = "approve" | "override" | "reject" | "sent" | "paid" | "clawback";

const ACTION_META: Record<Action, { title: string; needsAmount?: boolean; needsReason: boolean; reasonLabel: string }> = {
  approve:  { title: "Approve entry", needsReason: false, reasonLabel: "" },
  override: { title: "Approve with override", needsAmount: true, needsReason: true, reasonLabel: "Reason for override" },
  reject:   { title: "Reject entry", needsReason: true, reasonLabel: "Reason for rejection" },
  sent:     { title: "Mark sent to accounts", needsReason: false, reasonLabel: "" },
  paid:     { title: "Mark as paid", needsReason: false, reasonLabel: "" },
  clawback: { title: "Mark as clawed back", needsReason: true, reasonLabel: "Clawback reason" },
};

export default function CommissionsReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("submitted");
  const [staffFilter, setStaffFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [actionEntry, setActionEntry] = useState<any | null>(null);
  const [action, setAction] = useState<Action>("approve");
  const [overrideAmt, setOverrideAmt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("commission_entries").select("*").order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    if (tab === "submitted" && e.status !== "submitted") return false;
    if (tab === "approved" && !["approved","sent_to_accounts","paid"].includes(e.status)) return false;
    if (tab === "closed" && !["rejected","clawed_back","paid"].includes(e.status)) return false;
    if (tab === "all") {}
    if (staffFilter && !(e.staff_name ?? "").toLowerCase().includes(staffFilter.toLowerCase())) return false;
    if (monthFilter && !(e.period_month ?? "").includes(monthFilter)) return false;
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    return true;
  });

  const openAction = (entry: any, a: Action) => {
    setActionEntry(entry); setAction(a);
    setOverrideAmt(entry.override_amount?.toString() ?? entry.calculated_amount?.toString() ?? "");
    setReason("");
  };

  const submitAction = async () => {
    if (!actionEntry || !user) return;
    const meta = ACTION_META[action];
    if (meta.needsReason && !reason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    if (meta.needsAmount && (!overrideAmt || isNaN(+overrideAmt))) { toast({ title: "Amount required", variant: "destructive" }); return; }
    setBusy(true);
    const now = new Date().toISOString();
    let patch: any = {};
    if (action === "approve") patch = { status: "approved", reviewed_by: user.id, reviewed_at: now, override_amount: null, override_reason: null, rejected_reason: null };
    else if (action === "override") patch = { status: "approved", reviewed_by: user.id, reviewed_at: now, override_amount: +overrideAmt, override_reason: reason };
    else if (action === "reject") patch = { status: "rejected", reviewed_by: user.id, reviewed_at: now, rejected_reason: reason };
    else if (action === "sent") patch = { status: "sent_to_accounts", sent_to_accounts_at: now };
    else if (action === "paid") patch = { status: "paid", paid_at: now };
    else if (action === "clawback") patch = { status: "clawed_back", clawed_back_at: now, clawed_back_by: user.id, clawback_reason: reason };
    const { error } = await supabase.from("commission_entries").update(patch).eq("id", actionEntry.id);
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Updated" });
    setActionEntry(null);
    load();
  };

  const counts = {
    submitted: entries.filter(e => e.status === "submitted").length,
    approved: entries.filter(e => ["approved","sent_to_accounts","paid"].includes(e.status)).length,
    closed: entries.filter(e => ["rejected","clawed_back","paid"].includes(e.status)).length,
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commission review</h1>
        <p className="text-sm text-muted-foreground">Approve, override or reject staff commission entries.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="submitted">Pending ({counts.submitted})</TabsTrigger>
          <TabsTrigger value="approved">Approved / Paid ({counts.approved})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({counts.closed})</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Staff search…" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="max-w-xs" />
        <Input placeholder="Month e.g. 2026-04" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="max-w-xs" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="bonus">Bonus</SelectItem>
            <SelectItem value="profit">Profit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client / Job</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No entries.</TableCell></TableRow>}
            {filtered.map((e) => {
              const amt = Number(e.override_amount ?? e.calculated_amount ?? 0);
              const detail =
                e.type === "recurring" ? `${e.hours ?? 0} hrs${e.hours_paid_confirmed ? "" : " (unpaid)"}` :
                e.type === "bonus" ? `${e.contract_hours ?? 0} hr contract${e.is_new_contract ? "" : " (NOT new)"}` :
                `£${e.profit_amount ?? 0} × ${e.profit_tier === "created" ? "15%" : "10%"}`;
              const warn = (e.type === "recurring" && !e.hours_paid_confirmed) || (e.type === "bonus" && !e.is_new_contract);
              return (
                <TableRow key={e.id}>
                  <TableCell>{e.period_month}</TableCell>
                  <TableCell className="text-sm">{e.staff_name ?? "—"}</TableCell>
                  <TableCell>{TYPE_LABEL[e.type as keyof typeof TYPE_LABEL]}</TableCell>
                  <TableCell>{e.client_or_job}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      {warn && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      {detail}
                    </div>
                    {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    £{amt.toFixed(2)}
                    {e.override_amount != null && Number(e.override_amount) !== Number(e.calculated_amount) && (
                      <div className="text-xs text-muted-foreground line-through">£{Number(e.calculated_amount).toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[e.status] ?? "secondary"}>{STATUS_LABEL[e.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {e.status === "submitted" && <>
                        <Button size="sm" onClick={() => openAction(e, "approve")}><CheckCircle2 className="mr-1 h-3 w-3" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => openAction(e, "override")}><Edit3 className="mr-1 h-3 w-3" />Override</Button>
                        <Button size="sm" variant="destructive" onClick={() => openAction(e, "reject")}><XCircle className="mr-1 h-3 w-3" />Reject</Button>
                      </>}
                      {e.status === "approved" && <Button size="sm" variant="outline" onClick={() => openAction(e, "sent")}><Send className="mr-1 h-3 w-3" />Sent</Button>}
                      {e.status === "sent_to_accounts" && <Button size="sm" variant="outline" onClick={() => openAction(e, "paid")}><Banknote className="mr-1 h-3 w-3" />Paid</Button>}
                      {["approved","sent_to_accounts","paid"].includes(e.status) && (
                        <Button size="sm" variant="ghost" onClick={() => openAction(e, "clawback")}><RotateCcw className="mr-1 h-3 w-3" />Clawback</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!actionEntry} onOpenChange={(o) => !o && setActionEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ACTION_META[action].title}</DialogTitle>
            <DialogDescription>{actionEntry?.staff_name} · {actionEntry?.client_or_job} · {actionEntry?.period_month}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {action === "override" && (
              <div>
                <Label>New amount (£)</Label>
                <Input type="number" step="0.01" value={overrideAmt} onChange={(e) => setOverrideAmt(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Originally calculated: £{Number(actionEntry?.calculated_amount ?? 0).toFixed(2)}</p>
              </div>
            )}
            {ACTION_META[action].needsReason && (
              <div>
                <Label>{ACTION_META[action].reasonLabel}</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              </div>
            )}
            {action === "clawback" && (
              <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Marks the entry as reversed in reports. Does not auto-deduct from future payouts.</AlertDescription></Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionEntry(null)}>Cancel</Button>
            <Button onClick={submitAction} disabled={busy}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
