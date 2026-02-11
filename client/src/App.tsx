import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/LoginPage";
import EmployeeDashboard from "@/pages/employee/DashboardPage";
import EmployeeRecap from "@/pages/employee/RecapPage";
import EmployeeInfo from "@/pages/employee/InfoPage";

import AdminDashboard from "@/pages/admin/DashboardPage";
import AdminEmployeeList from "@/pages/admin/EmployeeListPage";
import AttendanceSummaryPage from "@/pages/admin/AttendanceSummaryPage";
import AdminRecap from "@/pages/admin/RecapPage"; 
import InfoBoardPage from "@/pages/admin/InfoBoardPage";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, adminOnly }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && adminOnly && user.role !== 'admin') {
      setLocation("/");
    }
  }, [user, isLoading, setLocation, adminOnly]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (adminOnly && user.role !== 'admin') return null;

  return <Component />;
}

function DashboardSwitcher() {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  return <EmployeeDashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} adminOnly />
      </Route>
      <Route path="/admin/employees">
        <ProtectedRoute component={AdminEmployeeList} adminOnly />
      </Route>
      <Route path="/admin/recap">
        <ProtectedRoute component={AdminRecap} adminOnly />
      </Route>
      <Route path="/admin/attendance-summary">
        <ProtectedRoute component={AttendanceSummaryPage} adminOnly />
      </Route>
      <Route path="/admin/info-board">
        <ProtectedRoute component={InfoBoardPage} adminOnly />
      </Route>

      {/* Employee & Shared Routes */}
      <Route path="/">
        <ProtectedRoute component={DashboardSwitcher} />
      </Route>
      <Route path="/recap">
        <ProtectedRoute component={EmployeeRecap} />
      </Route>
      <Route path="/info">
        <ProtectedRoute component={EmployeeInfo} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
