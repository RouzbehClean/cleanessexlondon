import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { RequireAuth, RequireAdmin, RequireOwnerOrAdmin } from "@/lib/guards";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SetPassword from "@/pages/SetPassword";
import Home from "@/pages/Home";
import Today from "@/pages/Today";
import Week from "@/pages/Week";
import Delivery from "@/pages/Delivery";
import Closures from "@/pages/Closures";
import Alerts from "@/pages/Alerts";
import Reports from "@/pages/Reports";
import SitesList from "@/pages/SitesList";
import SiteDetail from "@/pages/SiteDetail";
import CleanersList from "@/pages/CleanersList";
import CleanerDetail from "@/pages/CleanerDetail";
import Uploads from "@/pages/Uploads";
import Users from "@/pages/Users";
import Overrides from "@/pages/Overrides";
import Commissions from "@/pages/Commissions";
import CommissionsReview from "@/pages/CommissionsReview";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/" element={<Home />} />
              <Route path="/today" element={<Today />} />
              <Route path="/week" element={<Week />} />
              <Route path="/delivery" element={<Delivery />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/closures" element={<Closures />} />
              <Route path="/sites" element={<SitesList />} />
              <Route path="/sites/:siteId" element={<SiteDetail />} />
              <Route path="/cleaners" element={<CleanersList />} />
              <Route path="/cleaners/:cleanerId" element={<CleanerDetail />} />
              <Route path="/uploads" element={<RequireAdmin><Uploads /></RequireAdmin>} />
              <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
              <Route path="/overrides" element={<RequireAdmin><Overrides /></RequireAdmin>} />
              <Route path="/commissions" element={<Commissions />} />
              <Route path="/commissions/review" element={<RequireOwnerOrAdmin><CommissionsReview /></RequireOwnerOrAdmin>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
