import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Users() {
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const list = (roles ?? []) as { user_id: string; role: string }[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,email,display_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const grouped = new Map<string, any>();
    list.forEach((r) => {
      const cur = grouped.get(r.user_id) ?? { user_id: r.user_id, profile: pMap.get(r.user_id), roles: [] };
      cur.roles.push(r);
      grouped.set(r.user_id, cur);
    });
    setMembers(Array.from(grouped.values()));
  };

  useEffect(() => { refresh(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email, role, display_name: displayName || undefined },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((error?.message || JSON.stringify((data as any)?.error)) ?? "Invite failed");
    toast.success("Invite sent");
    setEmail(""); setDisplayName("");
    refresh();
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Users & roles</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Invite a team member</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Role</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff (read-only)</SelectItem>
                  <SelectItem value="admin">Admin (owner)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invite"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Roles</TableHead></TableRow></TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>{m.profile?.email ?? "—"}</TableCell>
                  <TableCell>{m.profile?.display_name ?? "—"}</TableCell>
                  <TableCell className="space-x-1">
                    {m.roles.map((r: any, i: number) => (
                      <Badge key={i} variant={r.role === "admin" ? "default" : "secondary"}>{r.role}</Badge>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
