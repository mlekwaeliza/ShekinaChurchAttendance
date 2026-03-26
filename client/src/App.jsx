import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import LeaderDashboard from './pages/LeaderDashboard.jsx';
import PastorDashboard from './pages/PastorDashboard.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import './index.css';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-xl">Loading...</div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'leader' ? '/leader' : '/pastor'} />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'leader' ? '/leader' : '/pastor'} /> : <Login />} />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/leader" element={
        <ProtectedRoute allowedRoles={['leader']}>
          <Layout>
            <LeaderDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/pastor" element={
        <ProtectedRoute allowedRoles={['pastor']}>
          <Layout>
            <PastorDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/change-password" element={
        <ProtectedRoute allowedRoles={['admin', 'leader', 'pastor']}>
          <Layout showNav={false}>
            <ChangePasswordPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
