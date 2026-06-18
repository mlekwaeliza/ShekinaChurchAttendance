import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PWAInstallPrompt from './components/PWAInstallPrompt.jsx';
import PWAUpdatePrompt from './components/PWAUpdatePrompt.jsx';
import usePWA from './hooks/usePWA.js';
import './index.css';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const LeaderDashboard = lazy(() => import('./pages/LeaderDashboard.jsx'));
const PastorDashboard = lazy(() => import('./pages/PastorDashboard.jsx'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'));
const ChurchCalendar = lazy(() => import('./components/ChurchCalendar.jsx'));

function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-2 border-primary-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();
  const { user, loading } = auth || { user: null, loading: true };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles || !allowedRoles.includes(user.role)) {
    const redirectPath = user.role === 'admin' ? '/admin' : user.role === 'pastor' ? '/pastor' : user.is_new_member_leader ? '/leader/new-members' : '/leader';
    return <Navigate to={redirectPath} />;
  }

  return children;
}

function AppRoutes() {
  const auth = useAuth();
  const user = auth?.user;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'leader' ? '/leader' : '/pastor'} /> : <Login />} />

        {/* Admin Routes */}
        <Route path="/admin/:tab?" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <AdminDashboard />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Leader Routes */}
        <Route path="/leader/:tab?" element={
          <ProtectedRoute allowedRoles={['leader']}>
            <Layout>
              <LeaderDashboard />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Pastor Routes */}
        <Route path="/pastor/:tab?" element={
          <ProtectedRoute allowedRoles={['pastor']}>
            <Layout>
              <PastorDashboard />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/change-password" element={
          <ProtectedRoute allowedRoles={['admin', 'leader', 'pastor']}>
            <Layout>
              <ChangePasswordPage />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/calendar" element={
          <ProtectedRoute allowedRoles={['admin', 'leader', 'pastor']}>
            <Layout>
              <ChurchCalendar />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const { updateAvailable, updateApp, dismissUpdate } = usePWA();

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
            <PWAInstallPrompt />
            {updateAvailable && (
              <PWAUpdatePrompt onRefresh={updateApp} onDismiss={dismissUpdate} />
            )}
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
