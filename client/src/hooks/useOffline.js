import { useState, useEffect, useCallback, useRef } from 'react';
import {
  queueAttendanceSubmission,
  getUnsyncedSubmissions,
  markAsSynced,
  markAsConflict,
  deleteQueuedRecord,
  getAllQueuedRecords,
  getQueuedSubmissionForDate
} from '../services/offlineDB';
import { leaderAPI } from '../services/api';

const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      loadPendingCount();
      loadConflicts();
    }
  }, [isOnline]);

  const loadPendingCount = useCallback(async () => {
    try {
      const unsynced = await getUnsyncedSubmissions();
      setPendingCount(unsynced.filter(r => !r.conflict).length);
    } catch (e) {
      console.error('Failed to load pending count:', e);
    }
  }, []);

  const loadConflicts = useCallback(async () => {
    try {
      const all = await getAllQueuedRecords();
      setConflicts(all.filter(r => r.conflict));
    } catch (e) {
      console.error('Failed to load conflicts:', e);
    }
  }, []);

  const queueSubmission = useCallback(async (data) => {
    const existing = await getQueuedSubmissionForDate(data.date, data.service_id);
    if (existing) {
      return { success: false, reason: 'already_queued', record: existing };
    }
    const id = await queueAttendanceSubmission(data);
    await loadPendingCount();
    return { success: true, id };
  }, [loadPendingCount]);

  const syncPending = useCallback(async (submitFn) => {
    if (syncInProgress.current || !isOnline) return { synced: 0, failed: 0, conflicts: 0 };
    syncInProgress.current = true;
    setSyncing(true);

    try {
      const unsynced = await getUnsyncedSubmissions();
      let synced = 0;
      let failed = 0;
      let conflictCount = 0;

      for (const record of unsynced) {
        if (record.conflict) continue;
        try {
          await submitFn(record);
          await markAsSynced(record.id);
          synced++;
        } catch (error) {
          const errorMsg = error.response?.data?.error || '';
          if (errorMsg.includes('already submitted') || errorMsg.includes('Already')) {
            await markAsSynced(record.id);
            synced++;
          } else {
            failed++;
          }
        }
      }

      await loadPendingCount();
      await loadConflicts();
      return { synced, failed, conflicts: conflictCount };
    } catch (error) {
      console.error('Failed to sync pending attendance:', error);
      return { synced: 0, failed: 1, conflicts: 0 };
    } finally {
      syncInProgress.current = false;
      setSyncing(false);
    }
  }, [isOnline, loadPendingCount, loadConflicts]);

  const resolveConflict = useCallback(async (id, action) => {
    if (action === 'discard') {
      await deleteQueuedRecord(id);
    } else if (action === 'overwrite') {
      const all = await getAllQueuedRecords();
      const record = all.find(r => r.id === id);
      if (record) {
        try {
          if (record.package) {
            await leaderAPI.syncOfflinePackage(record.package);
          } else {
            await leaderAPI.submitAttendance(record.date, record.attendance, record.service_id);
          }
          await markAsSynced(record.id);
        } catch (e) {
          console.error('Failed to overwrite:', e);
        }
      }
    }
    await loadPendingCount();
    await loadConflicts();
  }, [loadPendingCount, loadConflicts]);

  return {
    isOnline,
    pendingCount,
    conflicts,
    syncing,
    queueSubmission,
    syncPending,
    resolveConflict,
    loadPendingCount,
    loadConflicts
  };
};

export default useOffline;
