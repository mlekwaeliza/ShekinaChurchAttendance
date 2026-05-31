import React, { createContext, useContext, useState, useCallback } from 'react';

const BreadcrumbContext = createContext();

export const useBreadcrumbs = () => {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider');
  }
  return context;
};

export const BreadcrumbProvider = ({ children }) => {
  const [extraBreadcrumbs, setExtraBreadcrumbs] = useState([]);

  const setCrumbs = useCallback((crumbs) => {
    setExtraBreadcrumbs(crumbs || []);
  }, []);

  const clearCrumbs = useCallback(() => {
    setExtraBreadcrumbs([]);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ extraBreadcrumbs, setCrumbs, clearCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};
