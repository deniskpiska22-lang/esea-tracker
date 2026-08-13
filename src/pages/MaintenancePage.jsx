import { useLanguage } from "../context/LanguageContext";

function MaintenancePage() {
  const { tr } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05070a] px-4 text-center text-white">
      <div className="text-xs font-black uppercase tracking-[0.3em] text-orange-400">
        ESEA Tracker
      </div>

      <h1 className="mt-4 text-3xl font-black md:text-4xl">
        {tr("Технические работы", "Under maintenance")}
      </h1>

      <p className="mt-4 max-w-md text-sm leading-6 text-gray-400">
        {tr(
          "Сайт временно недоступен — проводим технические работы. Мы уже всё чиним и скоро вернёмся, ничего делать не нужно.",
          "The site is temporarily unavailable while we run maintenance. We're already on it and will be back soon — no action needed on your end."
        )}
      </p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-gray-600">
        {tr("Спасибо за терпение", "Thanks for your patience")}
      </p>
    </div>
  );
}

export default MaintenancePage;
