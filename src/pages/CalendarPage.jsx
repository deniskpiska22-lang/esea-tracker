function CalendarPage() {
  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,140,0,0.06),transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-12 md:px-8">
        <h1 className="text-4xl font-bold leading-tight md:text-5xl">
          Event <span className="text-orange-500">Calendar</span>
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-gray-400">
          Tournaments will appear here soon.
        </p>
      </div>
    </div>
  );
}

export default CalendarPage;
