import React, { useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import FinanceView from '../components/admin/FinanceView';

const AccountantDashboard = () => {
  const { showToast } = useToast();
  const showMessage = useCallback((msg) => {
    showToast({ type: 'success', message: msg });
  }, [showToast]);

  return (
    <div className="space-y-6">
      <FinanceView showMessage={showMessage} userRole="accountant" />
    </div>
  );
};

export default AccountantDashboard;
