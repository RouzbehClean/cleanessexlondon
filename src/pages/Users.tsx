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
  const [sites, setSites] = useState<any[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "cleaner" | "client">("cleaner");
  const [cleanerId, setCleanerId] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, cleaner_id, site_id");
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const { data: profs } = await supabase.from("profiles").select("id,email,display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const grouped = new Map<string, any>();
    (roles ?? []).forEach((r) => {
      const cur = grouped.get(r.user_id) ?? { user_id: r.user_id, profile: pMap.get(r.user_id), roles: [] };
      cur.roles.push(r);
      grouped.set(r.user_id, cur);
    });
    setMembers(Array.from(grouped.values()));
  };

  useEffect(() => {
    refresh();
    supabase.from("sites").select("site_id,client_name").order("client_name").then(({ data }) => setSites(data ?? []));
    supabase.from("cleaners").select("cleaner_id,name").order("name").then(({ data }) => setCleaners(data ?? []));
  }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "cleaner" && !cleanerId) return toast.error("Pick a cleaner to link to");
    if (role === "client" && !siteId) return toast.error("Pick a site to link to");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email, role, display_name: displayName || undefined, cleaner_id: role === "cleaner" ? cleanerId : null, site_id: role === "client" ? siteId : null },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((error?.message || JSON.stringify((data as any)?.error)) ?? "Invite failed");
    toast.success("Invite sent");
    setEmail(""); setDisplayName(""); setCleanerId(""); setSiteId("");
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
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="cleaner">Cleaner</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "cleaner" && (
              <div className="space-y-1"><Label>Link to cleaner</Label>
                <Select value={cleanerId} onValueChange={setCleanerId}>
                  <SelectTrigger><SelectValue placeholder="Pick cleaner" /></SelectTrigger>
                  <SelectContent>{cleaners.map((c) => <SelectItem key={c.cleaner_id} value={c.cleaner_id}>{c.name ?? c.cleaner_id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {role === "client" && (
              <div className="space-y-1"><Label>Link to site</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Pick site" /></SelectTrigger>
                  <SelectContent>{sites.map((s) => <SelectItem key={s.site_id} value={s.site_id}>{s.client_name ?? s.site_id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
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
                      <Badge key={i} variant={r.role === "admin" ? "default" : "secondary"}>
                        {r.role}{r.cleaner_id ? ` · ${r.cleaner_id}` : ""}{r.site_id ? ` · ${r.site_id}` : ""}
                      </Badge>
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
