import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { GymLoader } from "@/components/ui/gym-loader";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardRedirect } from "@/components/auth/DashboardRedirect";

// Critical auth pages — loaded eagerly (small bundles)
import SetupPage from "./pages/Setup";
import AuthPage from "./pages/Auth";
import SetPasswordPage from "./pages/SetPassword";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import UnauthorizedPage from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import PublicWebsiteV1 from "./pages/PublicWebsiteV1";
const InclineAscent = lazy(() => import("./pages/InclineAscent"));
import EmbedLeadForm from "./pages/EmbedLeadForm";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import TermsPage from "./pages/Terms";
import ContractSignPage from "./pages/ContractSign";

// All other pages — lazy loaded for code splitting
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const MembersPage = lazy(() => import("./pages/Members"));
const LeadsPage = lazy(() => import("./pages/Leads"));
const PlansPage = lazy(() => import("./pages/Plans"));
const InvoicesPage = lazy(() => import("./pages/Invoices"));
const PaymentsPage = lazy(() => import("./pages/Payments"));
const ClassesPage = lazy(() => import("./pages/Classes"));
const PTSessionsPage = lazy(() => import("./pages/PTSessions"));
const AIFitnessPage = lazy(() => import("./pages/AIFitness"));
const EquipmentPage = lazy(() => import("./pages/Equipment"));
const EquipmentMaintenancePage = lazy(() => import("./pages/EquipmentMaintenance"));
const LockersPage = lazy(() => import("./pages/Lockers"));
const EmployeesPage = lazy(() => import("./pages/Employees"));
const HRMPage = lazy(() => import("./pages/HRM"));
const TrainersPage = lazy(() => import("./pages/Trainers"));
const StaffAttendancePage = lazy(() => import("./pages/StaffAttendance"));
const AttendanceDashboardPage = lazy(() => import("./pages/AttendanceDashboard"));
const TasksPage = lazy(() => import("./pages/Tasks"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogs"));
const BranchesPage = lazy(() => import("./pages/Branches"));
const AnnouncementsPage = lazy(() => import("./pages/Announcements"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const StorePage = lazy(() => import("./pages/Store"));
const POSPage = lazy(() => import("./pages/POS"));
const ReferralsPage = lazy(() => import("./pages/Referrals"));
const FeedbackPage = lazy(() => import("./pages/Feedback"));
const WhatsAppChatPage = lazy(() => import("./pages/WhatsAppChat"));
const FinancePage = lazy(() => import("./pages/Finance"));
const MemberPlansPage = lazy(() => import("./pages/MemberPlans"));
const ProductsPage = lazy(() => import("./pages/Products"));
const ProductCategoriesPage = lazy(() => import("./pages/ProductCategories"));
const BenefitTrackingPage = lazy(() => import("./pages/BenefitTracking"));
const AllBookingsPage = lazy(() => import("./pages/AllBookings"));

// Member-specific pages
const MemberDashboard = lazy(() => import("./pages/MemberDashboard"));
const MyAttendance = lazy(() => import("./pages/MyAttendance"));
const MyProgress = lazy(() => import("./pages/MyProgress"));
const MemberClassBooking = lazy(() => import("./pages/MemberClassBooking"));
const MyPTSessions = lazy(() => import("./pages/MyPTSessions"));
const MyInvoices = lazy(() => import("./pages/MyInvoices"));
const MemberRequests = lazy(() => import("./pages/MemberRequests"));
const MemberStore = lazy(() => import("./pages/MemberStore"));
const MyWorkout = lazy(() => import("./pages/MyWorkout"));
const MyDiet = lazy(() => import("./pages/MyDiet"));
const MyBenefits = lazy(() => import("./pages/MyBenefits"));
const BookBenefitSlot = lazy(() => import("./pages/BookBenefitSlot"));
const MemberProfile = lazy(() => import("./pages/MemberProfile"));
const MemberFeedback = lazy(() => import("./pages/MemberFeedback"));
const MemberAnnouncements = lazy(() => import("./pages/MemberAnnouncements"));
const MemberReferrals = lazy(() => import("./pages/MemberReferrals"));

// Trainer-specific pages
const TrainerDashboard = lazy(() => import("./pages/TrainerDashboard"));
const MyClients = lazy(() => import("./pages/MyClients"));
const TrainerEarnings = lazy(() => import("./pages/TrainerEarnings"));
const ScheduleSession = lazy(() => import("./pages/ScheduleSession"));
const TrainerPlanBuilder = lazy(() => import("./pages/TrainerPlanBuilder"));

// Staff-specific pages
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));
const FollowUpCenter = lazy(() => import("./pages/FollowUpCenter"));

// Admin pages
const AdminRoles = lazy(() => import("./pages/AdminRoles"));
const DeviceManagement = lazy(() => import("./pages/DeviceManagement"));
const ApprovalQueue = lazy(() => import("./pages/ApprovalQueue"));
const DiscountCouponsPage = lazy(() => import("./pages/DiscountCoupons"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealth"));

// Profile
const ProfilePage = lazy(() => import("./pages/Profile"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <GymLoader text="Loading..." />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Website */}
            <Route path="/" element={<PublicWebsite />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Embeddable lead form - no auth required */}
            <Route path="/embed/lead-form" element={<EmbedLeadForm />} />
            <Route path="/contract-sign/:token" element={<ContractSignPage />} />

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
            <Route path="/follow-up-center" element={<ProtectedRoute requiredRoles={['staff', 'manager', 'admin', 'owner']}><FollowUpCenter /></ProtectedRoute>} />

            {/* ==================== ADMIN/MANAGER/OWNER ROUTES ==================== */}
            <Route path="/dashboard" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/members" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><MembersPage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><LeadsPage /></ProtectedRoute>} />
            <Route path="/plans" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><PlansPage /></ProtectedRoute>} />
            <Route path="/attendance" element={<Navigate to="/attendance-dashboard" replace />} />
            <Route path="/feedback" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><FeedbackPage /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><InvoicesPage /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><PaymentsPage /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}><ClassesPage /></ProtectedRoute>} />
            <Route path="/pt-sessions" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'trainer', 'staff']}><PTSessionsPage /></ProtectedRoute>} />
            <Route path="/ai-fitness" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AIFitnessPage /></ProtectedRoute>} />
            <Route path="/trainer-plan-builder" element={<ProtectedRoute requiredRoles={['trainer']}><TrainerPlanBuilder /></ProtectedRoute>} />
            <Route path="/inventory" element={<Navigate to="/products" replace />} />
            <Route path="/equipment" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EquipmentPage /></ProtectedRoute>} />
            <Route path="/equipment-maintenance" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><EquipmentMaintenancePage /></ProtectedRoute>} />
            <Route path="/lockers" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><LockersPage /></ProtectedRoute>} />
            <Route path="/hrm" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><HRMPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><TasksPage /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><EmployeesPage /></ProtectedRoute>} />
            <Route path="/trainers" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><TrainersPage /></ProtectedRoute>} />
            <Route path="/staff-attendance" element={<Navigate to="/attendance-dashboard" replace />} />
            <Route path="/attendance-dashboard" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}><AttendanceDashboardPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/announcements" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}><AnnouncementsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/store" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><StorePage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><POSPage /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ReferralsPage /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><FinancePage /></ProtectedRoute>} />
            <Route path="/my-plans" element={<ProtectedRoute><MemberPlansPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/product-categories" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}><ProductCategoriesPage /></ProtectedRoute>} />
            <Route path="/benefit-tracking" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><BenefitTrackingPage /></ProtectedRoute>} />
            <Route path="/all-bookings" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><AllBookingsPage /></ProtectedRoute>} />
            <Route path="/whatsapp-chat" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}><WhatsAppChatPage /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><DeviceManagement /></ProtectedRoute>} />
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
          </Suspense>
          </BranchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
