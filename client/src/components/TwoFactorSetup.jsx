import React, { useState } from 'react';
import { Shield, Copy, Check, AlertTriangle } from 'lucide-react';
import { authAPI } from '../services/api';

const TwoFactorSetup = ({ onEnabled, onCancel }) => {
  const [step, setStep] = useState('setup');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.setup2FA();
      setSecret(res.data.secret);
      setQrCode(res.data.qrCode);
      setStep('scan');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (token.length < 6) {
      setError('Enter a valid 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.verify2FA(token);
      setBackupCodes(res.data.backupCodes);
      setStep('backup');
    } catch (e) {
      setError(e.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    onEnabled();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Two-Factor Authentication</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {step === 'setup' && 'Add an extra layer of security to your account'}
            {step === 'scan' && 'Scan the QR code with your authenticator app'}
            {step === 'verify' && 'Enter the code from your authenticator app'}
            {step === 'backup' && 'Save your backup codes in a safe place'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200/60 dark:border-rose-700/60 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 'setup' && (
        <div className="text-center py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app in addition to your password.
          </p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary">
            {loading ? 'Generating...' : 'Set Up 2FA'}
          </button>
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <img src={qrCode} alt="QR Code" className="w-48 h-48 rounded-xl border border-slate-200 dark:border-slate-700" />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Or enter this code manually:</p>
            <code className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-900 dark:text-slate-100">
              {secret}
            </code>
          </div>
          <button onClick={() => setStep('verify')} className="btn-primary w-full">
            Next: Verify Code
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <div>
            <label className="input-label">Enter 6-digit code</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input text-center text-2xl tracking-widest font-mono"
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
          </div>
          <button onClick={handleVerify} disabled={loading} className="btn-primary w-full">
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </button>
        </div>
      )}

      {step === 'backup' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Save these codes in a safe place. Each can only be used once.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <code key={i} className="text-sm font-mono bg-slate-50 dark:bg-slate-700 px-3 py-2 rounded-lg text-center text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600">
                {code}
              </code>
            ))}
          </div>
          <button onClick={handleCopyCodes} className="btn-secondary w-full">
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy All Codes</>}
          </button>
          <button onClick={handleDone} className="btn-primary w-full">
            Done
          </button>
        </div>
      )}

      <button onClick={onCancel} className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 w-full text-center">
        Cancel
      </button>
    </div>
  );
};

export default TwoFactorSetup;
