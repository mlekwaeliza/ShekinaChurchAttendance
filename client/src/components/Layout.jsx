import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = {
    admin: [
      { path: '/admin', label: 'Dashboard', icon: '📊' },
      { path: '/admin/members', label: 'Members', icon: '👥' },
      { path: '/admin/upload', label: 'Upload CSV', icon: '📤' },
      { path: '/admin/leaders', label: 'Leaders', icon: '👔' },
    ],
    leader: [
      { path: '/leader', label: 'Take Attendance', icon: '✅' },
      { path: '/leader/history', label: 'History', icon: '📋' },
    ],
    pastor: [
      { path: '/pastor', label: 'Dashboard', icon: '📊' },
      { path: '/pastor/leaders', label: 'Leader Performance', icon: '📈' },
      { path: '/pastor/at-risk', label: 'At-Risk Members', icon: '⚠️' },
    ]
  };

  const currentNav = navItems[user?.role] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold">Church Attendance</h1>
              <span className="bg-primary-700 px-3 py-1 rounded-full text-sm">
                {user?.role?.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="hidden sm:block">{user?.full_name}</span>
              <button
                onClick={logout}
                className="bg-primary-700 hover:bg-primary-800 px-4 py-2 rounded text-sm transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        {currentNav.length > 0 && (
          <nav className="mb-8 bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-2">
              {currentNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    location.pathname === item.path
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Main Content */}
        <main>{children}</main>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          Church Attendance Tracking System
        </div>
      </footer>
    </div>
  );
};

export default Layout;
