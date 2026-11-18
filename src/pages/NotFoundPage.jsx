import Link from '../components/SiteLink.jsx';
import { tx } from '../i18n/translate.js';
export default function NotFoundPage() {
  return <main className="mx-auto max-w-3xl px-5 py-20 text-center text-white">
    <p className="text-orange-400">404</p>
    <h1 className="mt-3 text-3xl font-black">{tx('Page not found')}</h1>
    <p className="my-6 text-slate-400">{tx('This page is unavailable.')}</p>
    <Link className="inline-block rounded-xl bg-orange-500 px-5 py-3 font-bold" to="/">{tx('← Back to Home')}</Link>
  </main>;
}
