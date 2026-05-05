import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Building2, Users, Upload, UserCog, LogOut, Home, Sparkles, CalendarDays, CalendarRange, ClipboardCheck, CalendarOff, AlertTriangle, BarChart3, History, Coins, ClipboardList } from "lucide-react";

export default function AppShell() {
  const { isAdmin, isOwnerOrAdmin, isOwner, signOut, user } = useAuth();
  const nav = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
    }`;

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-gradient-surface">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <Link to="/" className="text-base font-semibold tracking-tight text-foreground">
            Clean Ops
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/" end className={linkClass}><Home className="h-4 w-4" />Home</NavLink>
          <NavLink to="/today" className={linkClass}><CalendarDays className="h-4 w-4" />Today</NavLink>
          <NavLink to="/week" className={linkClass}><CalendarRange className="h-4 w-4" />Week</NavLink>
          <NavLink to="/delivery" className={linkClass}><ClipboardCheck className="h-4 w-4" />Delivery</NavLink>
          <NavLink to="/alerts" className={linkClass}><AlertTriangle className="h-4 w-4" />Alerts</NavLink>
          <NavLink to="/reports" className={linkClass}><BarChart3 className="h-4 w-4" />Reports</NavLink>
          <NavLink to="/sites" className={linkClass}><Building2 className="h-4 w-4" />Sites</NavLink>
          <NavLink to="/cleaners" className={linkClass}><Users className="h-4 w-4" />Cleaners</NavLink>
          <NavLink to="/closures" className={linkClass}><CalendarOff className="h-4 w-4" />Closures</NavLink>
          <NavLink to="/commissions" className={linkClass}><Coins className="h-4 w-4" />Commissions</NavLink>
          {isOwnerOrAdmin && <NavLink to="/commissions/review" className={linkClass}><ClipboardList className="h-4 w-4" />Review queue</NavLink>}
          {isAdmin && <NavLink to="/uploads" className={linkClass}><Upload className="h-4 w-4" />Uploads</NavLink>}
          {isAdmin && <NavLink to="/users" className={linkClass}><UserCog className="h-4 w-4" />Users</NavLink>}
          {isAdmin && <NavLink to="/overrides" className={linkClass}><History className="h-4 w-4" />Edits</NavLink>}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-sidebar-foreground/90">{user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                {isOwner ? "Owner" : isAdmin ? "Admin" : "Staff"}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => { await signOut(); nav("/login"); }}
          >
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
