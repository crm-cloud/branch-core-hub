import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import SetupPage from "./pages/Setup";
import AuthPage from "./pages/Auth";
import SetPasswordPage from "./pages/SetPassword";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import DashboardPage from "./pages/Dashboard";
import MembersPage from "./pages/Members";
import LeadsPage from "./pages/Leads";
import PlansPage from "./pages/Plans";
import InvoicesPage from "./pages/Invoices";
import PaymentsPage from "./pages/Payments";
import AttendancePage from "./pages/Attendance";
import ClassesPage from "./pages/Classes";
import PTSessionsPage from "./pages/PTSessions";
import AIFitnessPage from "./pages/AIFitness";
import InventoryPage from "./pages/Inventory";
import EquipmentPage from "./pages/Equipment";
import EquipmentMaintenancePage from "./pages/EquipmentMaintenance";
import LockersPage from "./pages/Lockers";
import EmployeesPage from "./pages/Employees";
import HRMPage from "./pages/HRM";
import TrainersPage from "./pages/Trainers";
import StaffAttendancePage from "./pages/StaffAttendance";
import TasksPage from "./pages/Tasks";
import AnalyticsPage from "./pages/Analytics";
import AuditLogsPage from "./pages/AuditLogs";
import AdminUsersPage from "./pages/AdminUsers";
import BranchesPage from "./pages/Branches";
import AnnouncementsPage from "./pages/Announcements";
import SettingsPage from "./pages/Settings";
import StorePage from "./pages/Store";
import POSPage from "./pages/POS";
import ReferralsPage from "./pages/Referrals";
import FeedbackPage from "./pages/Feedback";
import PublicWebsite from "./pages/PublicWebsite";
import WebsiteCMSPage from "./pages/WebsiteCMS";
import IntegrationsPage from "./pages/Integrations";
import WhatsAppChatPage from "./pages/WhatsAppChat";
import UnauthorizedPage from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Website */}
            <Route path="/" element={<PublicWebsite />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/members" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><MembersPage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><LeadsPage /></ProtectedRoute>} />
            <Route path="/plans" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><PlansPage /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><AttendancePage /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><FeedbackPage /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><InvoicesPage /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><PaymentsPage /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}><ClassesPage /></ProtectedRoute>} />
            <Route path="/pt-sessions" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'trainer']}><PTSessionsPage /></ProtectedRoute>} />
            <Route path="/ai-fitness" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'trainer']}><AIFitnessPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><InventoryPage /></ProtectedRoute>} />
            <Route path="/equipment" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EquipmentPage /></ProtectedRoute>} />
            <Route path="/equipment-maintenance" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EquipmentMaintenancePage /></ProtectedRoute>} />
            <Route path="/lockers" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><LockersPage /></ProtectedRoute>} />
            <Route path="/hrm" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><HRMPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><TasksPage /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EmployeesPage /></ProtectedRoute>} />
            <Route path="/trainers" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><TrainersPage /></ProtectedRoute>} />
            <Route path="/staff-attendance" element={<ProtectedRoute><StaffAttendancePage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><BranchesPage /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><AnnouncementsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/store" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><StorePage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><POSPage /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ReferralsPage /></ProtectedRoute>} />
            <Route path="/website-cms" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><WebsiteCMSPage /></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><IntegrationsPage /></ProtectedRoute>} />
            <Route path="/whatsapp-chat" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><WhatsAppChatPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
