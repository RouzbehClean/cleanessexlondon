import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Building2, Users, Upload, UserCog, LogOut, Home } from "lucide-react";

export default function AppShell() {
  const { isAdmin, signOut, user } = useAuth();
  const nav = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
    }`;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="border-b p-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">Sterling Ops</Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/" end className={linkClass}><Home className="h-4 w-4" />Home</NavLink>
          <NavLink to="/sites" className={linkClass}><Building2 className="h-4 w-4" />Sites</NavLink>
          <NavLink to="/cleaners" className={linkClass}><Users className="h-4 w-4" />Cleaners</NavLink>
          {isAdmin && <NavLink to="/uploads" className={linkClass}><Upload className="h-4 w-4" />Uploads</NavLink>}
          {isAdmin && <NavLink to="/users" className={linkClass}><UserCog className="h-4 w-4" />Users</NavLink>}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); nav("/login"); }}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
