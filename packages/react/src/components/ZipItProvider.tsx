import React, { createContext, useContext, useMemo } from 'react';
import { useZipIt, type UseZipItResult } from '../hooks/useZipIt';
import type { ZipitConfig } from '@khatiwadaprashant/zipit-core';

const ZipItContext = createContext<UseZipItResult | null>(null);

export interface ZipItProviderProps {
  config?: Partial<ZipitConfig>;
  children: React.ReactNode;
  /** Internal use for simulation/testing */
  value?: UseZipItResult;
}

/**
 * ZipItProvider — provides ZipIt state and actions to all child components.
 * 
 * Usage:
 * ```tsx
 * <ZipItProvider config={{ concurrency: 4 }}>
 *   <ZipItUI />
 * </ZipItProvider>
 * ```
 */
export const ZipItProvider: React.FC<ZipItProviderProps> = ({ config, children, value }) => {
  const zipIt = useZipIt(config);
  const contextValue = value ?? zipIt;

  return (
    <ZipItContext.Provider value={contextValue}>
      {children}
    </ZipItContext.Provider>
  );
};

export function useZipItContext(): UseZipItResult {
  const context = useContext(ZipItContext);
  if (!context) {
    throw new Error('useZipItContext must be used within a ZipItProvider');
  }
  return context;
}
