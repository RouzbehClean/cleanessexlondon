import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
      setChecking(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return toast.error("Passwords don't match");
    if (pw.length < 8) return toast.error("Use at least 8 characters");

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);

    if (error) return toast.error(error.message);
    toast.success("Password updated");
    nav("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <p className="text-sm text-muted-foreground">Checking reset link…</p>
          ) : !ready ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">This reset link is invalid or expired.</p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
