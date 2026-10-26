import { useEffect } from 'react';
import { tx } from '../../i18n/translate.js';
export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    const navigate = event => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || event.ctrlKey || event.metaKey) return;
      if (!window.confirm(tx('Discard unsaved changes?'))) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener('click', navigate, true);
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
}
