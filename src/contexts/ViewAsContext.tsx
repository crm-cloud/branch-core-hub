import { createContext, useContext, useState, ReactNode } from 'react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface ViewAsContextType {
  viewAsRole: AppRole | null;
  setViewAsRole: (role: AppRole | null) => void;
  isViewingAs: boolean;
}

const ViewAsContext = createContext<ViewAsContextType | undefined>(undefined);

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsRole, setViewAsRole] = useState<AppRole | null>(null);

  return (
    <ViewAsContext.Provider value={{
      viewAsRole,
      setViewAsRole,
      isViewingAs: viewAsRole !== null,
    }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (!context) {
    throw new Error('useViewAs must be used within ViewAsProvider');
  }
  return context;
}
