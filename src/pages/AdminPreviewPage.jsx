import { useEffect } from 'react';
import { tx } from '../i18n/translate.js';
import { AdminDataContext } from '../components/admin/adminDataContext.js';
import { PREVIEW_API, PREVIEW_TEAMS } from '../components/admin/adminPreviewData.js';
import AdminWorkspace from '../components/admin/AdminWorkspace.jsx';
export default function AdminPreviewPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Admin preview · ESEA Tracker';
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.append(meta);
    return () => { document.title = previousTitle; meta.remove(); };
  }, []);
  return <AdminDataContext.Provider value={PREVIEW_API}><AdminWorkspace preview teams={PREVIEW_TEAMS} profile={{display_name:tx('Demo administrator')}} /></AdminDataContext.Provider>;
}
