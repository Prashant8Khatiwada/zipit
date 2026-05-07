import React, { useEffect, useState } from 'react';
import { useZipItContext } from './ZipItProvider';
import { SessionStore } from '@khatiwadaprashant/zipit-core';

export interface RecoveryBannerProps {
  children: (props: { 
    sessionIds: string[]; 
    onRecover: (id: string) => void 
  }) => React.ReactNode;
}

/**
 * ZipIt.RecoveryBanner — displays interrupted sessions for recovery.
 */
export const RecoveryBanner: React.FC<RecoveryBannerProps> = ({ children }) => {
  const { isRecoverable, recover } = useZipItContext();
  const [sessionIds, setSessionIds] = useState<string[]>([]);

  useEffect(() => {
    if (isRecoverable) {
      SessionStore.open().then(async (store) => {
        const sessions = await store.listSessions();
        const interrupted = sessions
          .filter(s => s.status === 'running' || s.status === 'paused')
          .map(s => s.sessionId);
        setSessionIds(interrupted);
        store.close();
      });
    }
  }, [isRecoverable]);

  if (!isRecoverable || sessionIds.length === 0) return null;

  return <>{children({ sessionIds, onRecover: recover })}</>;
};
