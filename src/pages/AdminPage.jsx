import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTeamCatalog } from '../hooks/useTeamCatalog.js';
import { supabase } from '../lib/supabaseClient.js';
import { tx } from '../i18n/translate.js';
import { Empty, Notice } from '../components/admin/AdminUI.jsx';
import { AdminDataContext } from '../components/admin/adminDataContext.js';
import { createAdminApi } from '../components/admin/adminApi.js';
import AdminWorkspace from '../components/admin/AdminWorkspace.jsx';
export default function AdminPage() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  if (loading) return <main className="admin-workspace"><Empty>{tx('Loading...')}</Empty></main>;
  if (user && profileError && !profile) return <main className="admin-workspace"><Empty><Notice error>{tx('Your profile is still loading. Please try again.')}</Notice><button type="button" className="admin-btn" onClick={refreshProfile}>{tx('Retry')}</button></Empty></main>;
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return <LiveWorkspace profile={profile} />;
}
function LiveWorkspace({ profile }) {
  const { teams } = useTeamCatalog();
  const api = useMemo(() => createAdminApi(supabase), []);
  return <AdminDataContext.Provider value={api}><AdminWorkspace teams={teams} profile={profile} /></AdminDataContext.Provider>;
}
