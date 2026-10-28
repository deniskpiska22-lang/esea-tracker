export const DEMO_UPLOAD_LIMIT = 256 * 1024 * 1024;
export function demoUploadMatchId(value) {
  const text = String(value || '').trim();
  if (/^1-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(text)) return text;
  try {
    const url = new URL(text);
    if (!['eseatracker.ru', 'www.eseatracker.ru', 'faceit.com', 'www.faceit.com'].includes(url.hostname)) return null;
    return url.pathname.match(/\/(?:match|room)\/(1-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:\/|$)/i)?.[1] || null;
  } catch { return null; }
}
export function validDemoUpload(file) {
  return Boolean(file && /\.dem(?:\.gz|\.zst)?$/i.test(file.name) && Number.isInteger(file.size)
    && file.size >= 8 && file.size <= DEMO_UPLOAD_LIMIT);
}
