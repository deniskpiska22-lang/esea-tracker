import { createContext, useContext } from 'react';
export const AdminDataContext = createContext(null);
export function useAdminData() {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error('Admin data provider is required');
  return value;
}
