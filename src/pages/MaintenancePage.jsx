function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05070a] px-4 text-center text-white">
      <div className="text-xs font-black uppercase tracking-[0.3em] text-orange-400">
        ESEA Tracker
      </div>

      <h1 className="mt-4 text-3xl font-black md:text-4xl">
        Технические работы
      </h1>

      <p className="mt-4 max-w-md text-sm leading-6 text-gray-400">
        Сайт временно недоступен — проводим технические работы. Мы уже
        всё чиним и скоро вернёмся, ничего делать не нужно.
      </p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-gray-600">
        Спасибо за терпение
      </p>
    </div>
  );
}

export default MaintenancePage;
