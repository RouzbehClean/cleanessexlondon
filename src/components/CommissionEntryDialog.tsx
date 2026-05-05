import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculate, CommissionRules, CommissionType, ProfitTier, TYPE_LABEL } from "@/lib/commission";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Calculator } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rules: CommissionRules;
  entry?: any | null;
  onSaved: () => void;
}

const monthNow = () => new Date().toISOString().slice(0, 7);

export default function CommissionEntryDialog({ open, onOpenChange, rules, entry, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<CommissionType>("recurring");
  const [client, setClient] = useState("");
  const [period, setPeriod] = useState(monthNow());
  const [hours, setHours] = useState("");
  const [hoursPaid, setHoursPaid] = useState(false);
  const [contractHours, setContractHours] = useState("");
  const [isNew, setIsNew] = useState(true);
  const [profit, setProfit] = useState("");
  const [profitTier, setProfitTier] = useState<ProfitTier>("identified");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      if (entry) {
        setType(entry.type);
        setClient(entry.client_or_job ?? "");
        setPeriod(entry.period_month ?? monthNow());
        setHours(entry.hours?.toString() ?? "");
        setHoursPaid(!!entry.hours_paid_confirmed);
        setContractHours(entry.contract_hours?.toString() ?? "");
        setIsNew(entry.is_new_contract ?? true);
        setProfit(entry.profit_amount?.toString() ?? "");
        setProfitTier((entry.profit_tier as ProfitTier) ?? "identified");
        setNotes(entry.notes ?? "");
      } else {
        setType("recurring"); setClient(""); setPeriod(monthNow());
        setHours(""); setHoursPaid(false); setContractHours("");
        setIsNew(true); setProfit(""); setProfitTier("identified"); setNotes("");
      }
    }
  }, [open, entry]);

  const calc = useMemo(() => calculate({
    type,
    hours: hours ? +hours : null,
    contract_hours: contractHours ? +contractHours : null,
    profit_amount: profit ? +profit : null,
    profit_tier: profitTier,
    is_new_contract: isNew,
    hours_paid_confirmed: hoursPaid,
  }, rules), [type, hours, contractHours, profit, profitTier, isNew, hoursPaid, rules]);

  const save = async (status: "draft" | "submitted") => {
    if (!user) return;
    if (!client.trim()) { toast({ title: "Client / job required", variant: "destructive" }); return; }
    if (!/^\d{4}-\d{2}$/.test(period)) { toast({ title: "Period must be YYYY-MM", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      staff_user_id: user.id,
      staff_name: user.email,
      type, client_or_job: client.trim(), period_month: period,
      hours: type === "recurring" ? (hours ? +hours : null) : null,
      hours_paid_confirmed: type === "recurring" ? hoursPaid : false,
      contract_hours: type === "bonus" ? (contractHours ? +contractHours : null) : null,
      is_new_contract: type === "bonus" ? isNew : true,
      profit_amount: type === "profit" ? (profit ? +profit : null) : null,
      profit_tier: type === "profit" ? profitTier : null,
      calculated_amount: calc.amount,
      notes: notes || null,
      status,
    };
    const { error } = entry
      ? await supabase.from("commission_entries").update(payload).eq("id", entry.id)
      : await supabase.from("commission_entries").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: status === "submitted" ? "Submitted for review" : "Saved as draft" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit commission entry" : "New commission entry"}</DialogTitle>
          <DialogDescription>Calculation updates live as you type.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CommissionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">{TYPE_LABEL.recurring}</SelectItem>
                  <SelectItem value="bonus">{TYPE_LABEL.bonus}</SelectItem>
                  <SelectItem value="profit">{TYPE_LABEL.profit}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period (YYYY-MM)</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-04" />
            </div>
          </div>

          <div>
            <Label>Client / Job</Label>
            <Input value={client} onChange={(e) => setClient(e.target.value)} />
          </div>

          {type === "recurring" && (
            <>
              <div>
                <Label>Hours worked</Label>
                <Input type="number" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Tiers: 10–30 £0.50 · 31–75 £0.75 · 76+ £1.00</p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="cursor-pointer">Hours invoiced & paid</Label>
                  <p className="text-xs text-muted-foreground">Required before commission is payable</p>
                </div>
                <Switch checked={hoursPaid} onCheckedChange={setHoursPaid} />
              </div>
            </>
          )}

          {type === "bonus" && (
            <>
              <div>
                <Label>Contract size (hours)</Label>
                <Input type="number" step="0.5" value={contractHours} onChange={(e) => setContractHours(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">&lt;10 £25 · 10–30 £50 · 30–50 £100 · 50+ £250</p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="cursor-pointer">Is a NEW contract</Label>
                  <p className="text-xs text-muted-foreground">Bonus only applies to new contracts</p>
                </div>
                <Switch checked={isNew} onCheckedChange={setIsNew} />
              </div>
            </>
          )}

          {type === "profit" && (
            <>
              <div>
                <Label>Profit (£)</Label>
                <Input type="number" step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} />
              </div>
              <div>
                <Label>Involvement</Label>
                <Select value={profitTier} onValueChange={(v) => setProfitTier(v as ProfitTier)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identified">Identified opportunity (10%)</SelectItem>
                    <SelectItem value="created">Created the sale (15%)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Min £15 · Max £150 per job</p>
              </div>
            </>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4" /> Calculated: £{calc.amount.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{calc.breakdown}</p>
            {calc.warnings.map((w, i) => (
              <Alert key={i} className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{w}</AlertDescription>
              </Alert>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => save("draft")} disabled={saving}>Save draft</Button>
          <Button onClick={() => save("submitted")} disabled={saving}>Submit for review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
