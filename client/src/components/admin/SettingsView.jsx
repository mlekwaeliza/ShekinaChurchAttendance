import React, { useState, useEffect } from 'react';
import { Settings, Shield, Camera, Upload, Key, Copy, Check, ShieldCheck, Trash2, Trophy, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI, adminAPI } from '../../services/api';
import TwoFactorSetup from '../TwoFactorSetup';
import Modal from '../ui/Modal';

const SettingsView = ({ leaders, loadCoreData, loadLeaders, showMessage }) => {
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [hallOfFameSettings, setHallOfFameSettings] = useState({
    points_attendance: '10',
    points_excused: '5',
    midweek_day: 'Wednesday'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    load2FAStatus();
    loadHallOfFameSettings();
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const res = await adminAPI.getMembers();
      setMembers(res.data);
    } catch (e) {
      console.error('Failed to load members:', e);
    }
  };

  const loadHallOfFameSettings = async () => {
    try {
      const res = await adminAPI.getSettingsConfig();
      setHallOfFameSettings(res.data);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await adminAPI.updateSettingsConfig(hallOfFameSettings);
      showMessage('Hall of Fame configuration updated');
    } catch (e) {
      showMessage('Failed to update settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const load2FAStatus = async () => {
    try {
      const res = await authAPI.get2FAStatus();
      setTwoFactorEnabled(res.data.enabled);
      setTwoFactorStatus(res.data);
    } catch (e) {
      console.error('Failed to load 2FA status:', e);
    }
  };

  const handle2FAEnabled = () => {
    setShow2FAModal(false);
    setTwoFactorEnabled(true);
    load2FAStatus();
    showMessage('Two-factor authentication enabled');
  };

  const handleDisable2FA = async () => {
    setDisabling2FA(true);
    try {
      await authAPI.disable2FA(disablePassword);
      setShowDisable2FA(false);
      setTwoFactorEnabled(false);
      setDisablePassword('');
      load2FAStatus();
      showMessage('Two-factor authentication disabled');
    } catch (e) {
      showMessage(e.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setDisabling2FA(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveName = async () => {
    if (!profileName.trim() || profileName.trim() === user?.full_name) return;
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({ full_name: profileName, member_id: selectedMemberId });
      updateUser({ full_name: res.data.full_name, member_id: selectedMemberId });
      showMessage('Profile updated successfully');
    } catch (err) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (leaderId) => {
    try {
      const res = await adminAPI.resetLeaderPassword(leaderId);
      setResetResult({ username: res.data.username, temp_password: res.data.temp_password });
      showMessage('Password reset successfully');
    } catch (error) {
      showMessage(`Failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await adminAPI.uploadCSV(file);
      loadCoreData();
      loadLeaders();
      showMessage('CSV uploaded successfully');
      if (result.data.results) {
        setUploadResult({
          results: result.data.results,
          tempPasswords: result.data.tempPasswords
        });
      }
    } catch (error) {
      showMessage(`Upload failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const triggerProfileUpload = () => {
    document.getElementById('profile-upload')?.click();
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Profile Section */}
      <div className="card p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
        <Settings className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
        Profile Settings
        </h3>
        <div className="space-y-5">
          {/* Display name */}
          <div>
            <label className="input-label">Display Name</label>
            <div className="flex gap-3">
              <select
                value={profileName}
                onChange={(e) => {
                  const val = e.target.value;
                  const [name, id] = val.split('|');
                  setProfileName(name);
                  setSelectedMemberId(id ? Number(id) : null);
                }}
                className="select flex-1"
              >
                <option value="">Select a member...</option>
                {members
                  .filter((m) => m.full_name)
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map((m) => (
                    <option key={m.id} value={`${m.full_name}|${m.id}`}>{m.full_name}</option>
                  ))}
              </select>
              <button
                onClick={handleSaveName}
                disabled={saving || !profileName.trim() || profileName.trim() === user?.full_name}
                className="btn-primary whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <Link to="/change-password" className="btn-secondary">
              <Shield className="w-4 h-4" />
              Change Password
            </Link>
            <button onClick={triggerProfileUpload} className="btn-secondary">
              <Camera className="w-4 h-4" />
              Update Photo
            </button>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
          Two-Factor Authentication
        </h3>
        {twoFactorEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/60">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">2FA is enabled</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {twoFactorStatus?.backupCodesRemaining || 0} backup codes remaining
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setShowDisable2FA(true)} className="btn-secondary text-rose-600 dark:text-rose-400">
                <Trash2 className="w-4 h-4" />
                Disable 2FA
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await authAPI.regenerateBackupCodes();
                    const codes = res.data.backupCodes;
                    const text = codes.join('\n');
                    navigator.clipboard.writeText(text);
                    showMessage('Backup codes regenerated and copied to clipboard');
                    load2FAStatus();
                  } catch (e) {
                    showMessage('Failed to regenerate backup codes');
                  }
                }}
                className="btn-secondary"
              >
                <Key className="w-4 h-4" />
                Regenerate Backup Codes
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Protect your account with an authenticator app. After enabling, you'll need a 6-digit code from your app to log in.
            </p>
            <button onClick={() => setShow2FAModal(true)} className="btn-primary">
              <ShieldCheck className="w-4 h-4" />
              Enable 2FA
            </button>
          </div>
        )}
      </div>

      {/* Leader Password Reset */}
      {isAdmin && (
      <div className="card p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
        <Key className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
        Leader Password Reset
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Generate a new temporary password for a leader. They will be prompted to change it on next login.
        </p>
        <div className="flex gap-3">
          <select id="leaderResetSelect" className="select flex-1">
            <option value="">Select a leader...</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name} ({l.section_name})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const id = document.getElementById('leaderResetSelect').value;
              if (id) handleResetPassword(id);
              else showMessage('Please select a leader first.');
            }}
            className="btn-danger whitespace-nowrap"
          >
            Reset Password
          </button>
        </div>
        {resetResult && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2">New Temporary Password</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white dark:bg-slate-700 px-3 py-2 rounded-lg">
                <span className="text-sm text-slate-600 dark:text-slate-400">Username: <strong>{resetResult.username}</strong></span>
                <button onClick={() => copyToClipboard(resetResult.username, 'username')} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                  {copiedField === 'username' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-slate-700 px-3 py-2 rounded-lg">
                <span className="text-sm text-slate-600 dark:text-slate-400">Password: <strong>{resetResult.temp_password}</strong></span>
                <button onClick={() => copyToClipboard(resetResult.temp_password, 'password')} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                  {copiedField === 'password' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Share these credentials securely and ask the leader to change their password on first login.</p>
            <button onClick={() => setResetResult(null)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mt-2">Dismiss</button>
          </div>
        )}
      </div>
      )}

      {/* CSV Import */}
      {isAdmin && (
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-8 text-white">
          <h3 className="text-lg font-bold mb-2">Data Import</h3>
          <p className="text-primary-100 text-sm max-w-lg">
            Bulk provision sections, leaders, and members via CSV upload. This will automatically create accounts and set up hierarchies.
          </p>
        </div>
        <div className="p-6">
          <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all cursor-pointer group">
            <Upload className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors mb-3" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {uploading ? 'Uploading...' : 'Click to upload CSV file'}
            </span>
            <span className="text-xs text-slate-400 mt-1">Supports .csv format</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
        {uploadResult && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-xl">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-2">Upload Complete</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-slate-500 dark:text-slate-400">Sections:</span> <strong>{uploadResult.results.sectionsCreated}</strong></div>
              <div><span className="text-slate-500 dark:text-slate-400">Leaders:</span> <strong>{uploadResult.results.leadersCreated}</strong></div>
              <div><span className="text-slate-500 dark:text-slate-400">Members:</span> <strong>{uploadResult.results.membersCreated}</strong></div>
            </div>
            {uploadResult.tempPasswords?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-2">New Leader Credentials</p>
                {uploadResult.tempPasswords.map((cred, i) => (
                  <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-700 px-3 py-2 rounded-lg mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400"><strong>{cred.username}</strong>: {cred.password}</span>
                    <button onClick={() => copyToClipboard(`${cred.username}: ${cred.password}`, `cred-${i}`)} className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                      {copiedField === `cred-${i}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploadResult.results.errors?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-1">Errors ({uploadResult.results.errors.length})</p>
                <ul className="text-xs text-rose-600 dark:text-rose-400 space-y-1 max-h-32 overflow-y-auto">
                  {uploadResult.results.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            <button onClick={() => setUploadResult(null)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mt-2">Dismiss</button>
          </div>
        )}
      </div>
      )}

      {/* Hall of Fame Configuration */}
      {isAdmin && (
      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2">
          <Trophy className="w-4.5 h-4.5 text-amber-500" />
          Hall of Fame Configuration
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Configure how points are awarded to members. These points contribute to the yearly leaderboard.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="input-label">Attendance Points</label>
            <input
              type="number"
              value={hallOfFameSettings.points_attendance}
              onChange={(e) => setHallOfFameSettings({ ...hallOfFameSettings, points_attendance: e.target.value })}
              className="input w-full"
              placeholder="e.g. 10"
            />
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Awarded for "Present" status</p>
          </div>
          <div>
            <label className="input-label">Excused Points</label>
            <input
              type="number"
              value={hallOfFameSettings.points_excused}
              onChange={(e) => setHallOfFameSettings({ ...hallOfFameSettings, points_excused: e.target.value })}
              className="input w-full"
              placeholder="e.g. 5"
            />
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Awarded for "Excused" status</p>
          </div>
          <div>
            <label className="input-label">Midweek Service Day</label>
            <select
              value={hallOfFameSettings.midweek_day}
              onChange={(e) => setHallOfFameSettings({ ...hallOfFameSettings, midweek_day: e.target.value })}
              className="select w-full"
            >
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={handleSaveSettings}
            disabled={settingsLoading}
            className="btn-primary"
          >
            {settingsLoading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
      )}

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <div className="modal-overlay" onClick={() => setShow2FAModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Two-Factor Authentication</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Scan the QR code with your authenticator app</p>
              </div>
              <button onClick={() => setShow2FAModal(false)} className="btn-icon btn-ghost p-1.5 -mr-1.5 rounded-xl active:scale-90" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <TwoFactorSetup
                onEnabled={handle2FAEnabled}
                onCancel={() => setShow2FAModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Disable 2FA Modal */}
      {showDisable2FA && (
        <div className="modal-overlay" onClick={() => { setShowDisable2FA(false); setDisablePassword(''); }}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Disable 2FA</h3>
              </div>
              <button onClick={() => { setShowDisable2FA(false); setDisablePassword(''); }} className="btn-icon btn-ghost p-1.5 -mr-1.5 rounded-xl active:scale-90" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enter your password to confirm disabling two-factor authentication.
              </p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="input h-10"
                placeholder="Enter your password"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => { setShowDisable2FA(false); setDisablePassword(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable2FA}
                disabled={disabling2FA || !disablePassword}
                className="btn-danger"
              >
                {disabling2FA ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Disabling...</span>
                ) : 'Disable 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
