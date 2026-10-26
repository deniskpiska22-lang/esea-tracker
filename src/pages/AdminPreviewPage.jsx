import { tx } from '../i18n/translate.js';
import { AdminDataContext } from '../components/admin/adminDataContext.js';
import { PREVIEW_API, PREVIEW_TEAMS } from '../components/admin/adminPreviewData.js';
import AdminWorkspace from '../components/admin/AdminWorkspace.jsx';
export default function AdminPreviewPage() {
  return <AdminDataContext.Provider value={PREVIEW_API}><AdminWorkspace preview teams={PREVIEW_TEAMS} profile={{display_name:tx('Demo administrator')}} /></AdminDataContext.Provider>;
}
