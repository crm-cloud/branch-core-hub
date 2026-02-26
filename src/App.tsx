import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardRedirect } from "@/components/auth/DashboardRedirect";
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
import EquipmentPage from "./pages/Equipment";
import EquipmentMaintenancePage from "./pages/EquipmentMaintenance";
import LockersPage from "./pages/Lockers";
import EmployeesPage from "./pages/Employees";
import HRMPage from "./pages/HRM";
import TrainersPage from "./pages/Trainers";
import StaffAttendancePage from "./pages/StaffAttendance";
import AttendanceDashboardPage from "./pages/AttendanceDashboard";
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

import FinancePage from "./pages/Finance";
import MemberPlansPage from "./pages/MemberPlans";
import ProductsPage from "./pages/Products";
import ProductCategoriesPage from "./pages/ProductCategories";
import BenefitTrackingPage from "./pages/BenefitTracking";
import AllBookingsPage from "./pages/AllBookings";

// Member-specific pages
import MemberDashboard from "./pages/MemberDashboard";
import MyAttendance from "./pages/MyAttendance";
import MyProgress from "./pages/MyProgress";
import MemberClassBooking from "./pages/MemberClassBooking";
import MyPTSessions from "./pages/MyPTSessions";
import MyInvoices from "./pages/MyInvoices";
import MemberRequests from "./pages/MemberRequests";
import MemberStore from "./pages/MemberStore";
import MyWorkout from "./pages/MyWorkout";
import MyDiet from "./pages/MyDiet";
import MyBenefits from "./pages/MyBenefits";
import BookBenefitSlot from "./pages/BookBenefitSlot";
import MemberProfile from "./pages/MemberProfile";
import MemberFeedback from "./pages/MemberFeedback";
import MemberAnnouncements from "./pages/MemberAnnouncements";
import MemberReferrals from "./pages/MemberReferrals";

// Trainer-specific pages
import TrainerDashboard from "./pages/TrainerDashboard";
import MyClients from "./pages/MyClients";
import TrainerEarnings from "./pages/TrainerEarnings";
import ScheduleSession from "./pages/ScheduleSession";

// Staff-specific pages
import StaffDashboard from "./pages/StaffDashboard";

// Admin pages
import AdminRoles from "./pages/AdminRoles";
import DeviceManagement from "./pages/DeviceManagement";
import ApprovalQueue from "./pages/ApprovalQueue";
import DiscountCouponsPage from "./pages/DiscountCoupons";
import SystemHealthPage from "./pages/SystemHealth";

// Profile & Embed
import ProfilePage from "./pages/Profile";
import EmbedLeadForm from "./pages/EmbedLeadForm";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BranchProvider>
          <Routes>
            {/* Public Website */}
            <Route path="/" element={<PublicWebsite />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Embeddable lead form - no auth required */}
            <Route path="/embed/lead-form" element={<EmbedLeadForm />} />

            {/* Smart Dashboard Redirect */}
            <Route path="/home" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

            {/* Profile - all authenticated roles */}
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            {/* ==================== MEMBER ROUTES ==================== */}
            <Route path="/member-dashboard" element={<ProtectedRoute requiredRoles={['member']}><MemberDashboard /></ProtectedRoute>} />
            <Route path="/my-attendance" element={<ProtectedRoute requiredRoles={['member']}><MyAttendance /></ProtectedRoute>} />
            <Route path="/my-progress" element={<ProtectedRoute requiredRoles={['member']}><MyProgress /></ProtectedRoute>} />
            <Route path="/my-classes" element={<ProtectedRoute requiredRoles={['member']}><MemberClassBooking /></ProtectedRoute>} />
            <Route path="/my-pt-sessions" element={<ProtectedRoute requiredRoles={['member']}><Navigate to="/my-classes?tab=appointments" replace /></ProtectedRoute>} />
            <Route path="/my-referrals" element={<ProtectedRoute requiredRoles={['member']}><MemberReferrals /></ProtectedRoute>} />
            <Route path="/my-invoices" element={<ProtectedRoute requiredRoles={['member']}><MyInvoices /></ProtectedRoute>} />
            <Route path="/my-requests" element={<ProtectedRoute requiredRoles={['member']}><MemberRequests /></ProtectedRoute>} />
            <Route path="/member-store" element={<ProtectedRoute requiredRoles={['member']}><MemberStore /></ProtectedRoute>} />
            <Route path="/member-announcements" element={<ProtectedRoute requiredRoles={['member']}><MemberAnnouncements /></ProtectedRoute>} />
            <Route path="/member-feedback" element={<ProtectedRoute requiredRoles={['member']}><MemberFeedback /></ProtectedRoute>} />
            <Route path="/my-workout" element={<ProtectedRoute requiredRoles={['member']}><MyWorkout /></ProtectedRoute>} />
            <Route path="/my-diet" element={<ProtectedRoute requiredRoles={['member']}><MyDiet /></ProtectedRoute>} />
            <Route path="/my-benefits" element={<ProtectedRoute requiredRoles={['member']}><MyBenefits /></ProtectedRoute>} />
            <Route path="/book-benefit" element={<ProtectedRoute requiredRoles={['member']}><BookBenefitSlot /></ProtectedRoute>} />
            <Route path="/member-profile" element={<ProtectedRoute requiredRoles={['member']}><MemberProfile /></ProtectedRoute>} />

            {/* ==================== TRAINER ROUTES ==================== */}
            <Route path="/trainer-dashboard" element={<ProtectedRoute requiredRoles={['trainer']}><TrainerDashboard /></ProtectedRoute>} />
            <Route path="/my-clients" element={<ProtectedRoute requiredRoles={['trainer']}><MyClients /></ProtectedRoute>} />
            <Route path="/trainer-earnings" element={<ProtectedRoute requiredRoles={['trainer']}><TrainerEarnings /></ProtectedRoute>} />
            <Route path="/schedule-session" element={<ProtectedRoute requiredRoles={['trainer']}><ScheduleSession /></ProtectedRoute>} />

            {/* ==================== STAFF ROUTES ==================== */}
            <Route path="/staff-dashboard" element={<ProtectedRoute requiredRoles={['staff']}><StaffDashboard /></ProtectedRoute>} />

            {/* ==================== ADMIN/MANAGER/OWNER ROUTES ==================== */}
            <Route path="/dashboard" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><DashboardPage /></ProtectedRoute>} />
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
            <Route path="/inventory" element={<Navigate to="/products" replace />} />
            <Route path="/equipment" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EquipmentPage /></ProtectedRoute>} />
            <Route path="/equipment-maintenance" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EquipmentMaintenancePage /></ProtectedRoute>} />
            <Route path="/lockers" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><LockersPage /></ProtectedRoute>} />
            <Route path="/hrm" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><HRMPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><TasksPage /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EmployeesPage /></ProtectedRoute>} />
            <Route path="/trainers" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><TrainersPage /></ProtectedRoute>} />
            <Route path="/staff-attendance" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}><StaffAttendancePage /></ProtectedRoute>} />
            <Route path="/attendance-dashboard" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><AttendanceDashboardPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}><AnnouncementsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/store" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><StorePage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><POSPage /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ReferralsPage /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><FinancePage /></ProtectedRoute>} />
            <Route path="/my-plans" element={<ProtectedRoute><MemberPlansPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/product-categories" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ProductCategoriesPage /></ProtectedRoute>} />
            <Route path="/benefit-tracking" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><BenefitTrackingPage /></ProtectedRoute>} />
            <Route path="/all-bookings" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><AllBookingsPage /></ProtectedRoute>} />
            <Route path="/whatsapp-chat" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><WhatsAppChatPage /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><DeviceManagement /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ApprovalQueue /></ProtectedRoute>} />
            <Route path="/discount-coupons" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><DiscountCouponsPage /></ProtectedRoute>} />
            {/* Admin user/role management */}
            <Route path="/admin-roles" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AdminRoles /></ProtectedRoute>} />
            <Route path="/system-health" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><SystemHealthPage /></ProtectedRoute>} />

            {/* Redirects for old routes */}
            <Route path="/admin/users" element={<Navigate to="/settings?tab=users" replace />} />
            <Route path="/branches" element={<Navigate to="/settings?tab=branches" replace />} />
            <Route path="/website-cms" element={<Navigate to="/settings?tab=website" replace />} />
            <Route path="/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </BranchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
