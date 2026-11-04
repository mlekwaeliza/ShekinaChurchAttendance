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
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-500/[0.12]">
          <Shield className="h-5 w-5 text-primary-700 dark:text-primary-300" />
        </div>
        <div>
          <h3 className="text-headline font-semibold text-label">Two-Factor Authentication</h3>
          <p className="text-footnote text-secondary-label">
            {step === 'setup' && 'Add an extra layer of security to your account'}
            {step === 'scan' && 'Scan the QR code with your authenticator app'}
            {step === 'verify' && 'Enter the code from your authenticator app'}
            {step === 'backup' && 'Save your backup codes in a safe place'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-system-red/10 px-4 py-3 text-footnote text-rose-700 dark:text-system-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 'setup' && (
        <div className="py-4 text-center">
          <p className="mb-6 text-footnote leading-relaxed text-secondary-label">
            Two-factor authentication adds an extra layer of security by requiring a code from your
            authenticator app in addition to your password.
          </p>
          <button onClick={handleGenerate} disabled={loading} className="btn-primary">
            {loading ? 'Generating...' : 'Set Up 2FA'}
          </button>
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <img
              src={qrCode}
              alt="QR Code"
              className="h-48 w-48 rounded-xl border border-separator/60 dark:border-white/[0.08]"
            />
          </div>
          <div className="text-center">
            <p className="mb-2 text-footnote text-secondary-label">Or enter this code manually:</p>
            <code className="rounded-lg bg-system-fill px-3 py-1.5 font-mono text-footnote text-label">
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
              className="input text-center font-mono text-2xl tracking-widest"
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
          <div className="flex items-center gap-2 rounded-xl bg-system-orange/10 px-4 py-3 text-footnote text-amber-700 dark:text-system-orange">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Save these codes in a safe place. Each can only be used once.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <code
                key={i}
                className="rounded-lg border border-separator/60 bg-system-grouped-background px-3 py-2 text-center font-mono text-footnote text-label dark:border-white/[0.06]"
              >
                {code}
              </code>
            ))}
          </div>
          <button onClick={handleCopyCodes} className="btn-secondary w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy All Codes
              </>
            )}
          </button>
          <button onClick={handleDone} className="btn-primary w-full">
            Done
          </button>
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full text-center text-footnote text-secondary-label transition-colors hover:text-label"
      >
        Cancel
      </button>
    </div>
  );
};

export default TwoFactorSetup;
