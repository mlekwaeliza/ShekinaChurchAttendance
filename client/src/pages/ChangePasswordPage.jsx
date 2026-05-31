import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const ChangePasswordPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const validatePasswordPolicy = (password) => {
    const failures = [];
    if (password.length < 12) failures.push('at least 12 characters');
    if (!/[a-z]/.test(password)) failures.push('one lowercase letter');
    if (!/[A-Z]/.test(password)) failures.push('one uppercase letter');
    if (!/\d/.test(password)) failures.push('one number');
    if (!/[^A-Za-z0-9]/.test(password)) failures.push('one symbol');
    if (/\s/.test(password)) failures.push('no spaces');
    return failures;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (formData.new_password !== formData.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    const passwordFailures = validatePasswordPolicy(formData.new_password);
    if (passwordFailures.length > 0) {
      setMessage({ type: 'error', text: `New password must contain ${passwordFailures.join(', ')}.` });
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(formData.current_password, formData.new_password);
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'leader' ? '/leader' : '/pastor';
        navigate(dashboardPath);
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to change password'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">Change Password</h2>

        <p className="text-gray-600 dark:text-slate-400 mb-4">
          logged in as <strong>{user?.username}</strong>
        </p>

        {message.text && (
          <div className={`mb-4 px-4 py-3 rounded ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-emerald-900/30 text-green-700 dark:text-emerald-400 border border-green-200 dark:border-emerald-700'
              : 'bg-red-50 dark:bg-rose-900/30 text-red-700 dark:text-rose-400 border border-red-200 dark:border-rose-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Current Password
            </label>
            <input
              type="password"
              name="current_password"
              value={formData.current_password}
              onChange={handleChange}
              required
              className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded px-3 py-2"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              required
              minLength={12}
              className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded px-3 py-2"
              placeholder="Enter new password"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Use 12+ characters with uppercase, lowercase, number, and symbol.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              minLength={12}
              className="w-full border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded px-3 py-2"
              placeholder="Re-enter new password"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded disabled:opacity-50"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
