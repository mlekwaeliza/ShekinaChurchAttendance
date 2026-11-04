import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (formData.new_password !== formData.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (formData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(formData.current_password, formData.new_password);
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        const dashboardPath =
          user?.role === 'admin' ? '/admin' : user?.role === 'leader' ? '/leader' : '/pastor';
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
    <div className="mx-auto mt-8 max-w-md">
      <div className="card p-6 sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-500/[0.12]">
            <KeyRound className="h-5 w-5 text-primary-700 dark:text-primary-300" />
          </span>
          <div>
            <h2 className="text-title-2 font-semibold text-label">Change Password</h2>
            <p className="mt-1 text-footnote text-secondary-label">
              Signed in as <strong className="font-semibold text-label">{user?.username}</strong>
            </p>
          </div>
        </div>

        {message.text && (
          <div
            className={`mb-4 flex items-start gap-3 rounded-xl px-4 py-3 text-footnote ${
              message.type === 'success'
                ? 'bg-system-green/10 text-emerald-700 dark:text-system-green'
                : 'bg-system-red/10 text-rose-700 dark:text-system-red'
            }`}
            role="status"
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label" htmlFor="current-password">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              name="current_password"
              value={formData.current_password}
              onChange={handleChange}
              required
              className="input"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="input-label" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              required
              minLength={6}
              className="input"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="input-label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              minLength={6}
              className="input"
              placeholder="Re-enter new password"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
