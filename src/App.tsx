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
import PlansPage from "./pages/Plans";
import AdminUsersPage from "./pages/AdminUsers";
import AttendancePage from "./pages/Attendance";
import LockersPage from "./pages/Lockers";
import StaffAttendancePage from "./pages/StaffAttendance";
import ClassesPage from "./pages/Classes";
import TrainersPage from "./pages/Trainers";
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
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/plans" element={
              <ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}>
                <PlansPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute requiredRoles={['owner', 'admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}>
                <AttendancePage />
              </ProtectedRoute>
            } />
            <Route path="/lockers" element={
              <ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}>
                <LockersPage />
              </ProtectedRoute>
            } />
            <Route path="/staff-attendance" element={
              <ProtectedRoute>
                <StaffAttendancePage />
              </ProtectedRoute>
            } />
            <Route path="/classes" element={
              <ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff', 'trainer']}>
                <ClassesPage />
              </ProtectedRoute>
            } />
            <Route path="/trainers" element={
              <ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}>
                <TrainersPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;