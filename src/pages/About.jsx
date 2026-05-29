import React from "react"
import { Link } from "react-router-dom"

function About() {
  return (
    <div className="min-h-screen text-white bg-[#05070a]">

      {/* background glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,140,0,0.06),transparent_60%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 relative">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-10">

          <Link
            to="/"
            className="text-xl md:text-2xl font-bold text-orange-500 hover:text-orange-400 transition"
          >
            Esea Tracker
          </Link>

          <div className="text-sm text-gray-500">
            About Project
          </div>

        </div>

        {/* TITLE BLOCK */}
        <div className="mb-12">

          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            О проекте <span className="text-orange-500">Esea Tracker</span>
          </h1>

          <p className="text-gray-400 mt-4 max-w-3xl leading-7">
            Независимая рейтинговая платформа CIS-команд ESEA.
            Цель — отслеживание прогресса, развитие сцены и создание единого рейтинга полупро сцены.
          </p>

        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Проект
            </h2>

            <p className="text-gray-300 leading-7">
              CIS ESEA Rankings создан, чтобы дать внимание командам вне тир-1 сцены.
              Многие составы из Advanced / Main / Intermediate / Entry остаются без медиа-освещения.
            </p>

            <p className="text-gray-400 leading-7 mt-4">
              Рейтинг формируется на основе результатов матчей, стабильности и дивизиона.
            </p>

          </div>

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Возможности
            </h2>

            <ul className="space-y-2 text-gray-300">
              <li>• Рейтинг CIS команд ESEA</li>
              <li>• Страницы команд с аналитикой</li>
              <li>• Дивизионная система</li>
              <li>• Статистика и динамика</li>
              <li>• Mobile-first интерфейс</li>
            </ul>

          </div>

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Система рейтинга
            </h2>

            <div className="space-y-4 text-gray-300">

              <div>
                <div className="text-white font-medium">Advanced</div>
                <div className="text-gray-400 text-sm">
                  Высокий множитель и вес матчей
                </div>
              </div>

              <div>
                <div className="text-white font-medium">Main</div>
                <div className="text-gray-400 text-sm">
                  Стабильность и бонус за победы
                </div>
              </div>

              <div>
                <div className="text-white font-medium">Intermediate / Entry</div>
                <div className="text-gray-400 text-sm">
                  Прогресс и базовый винрейт
                </div>
              </div>

            </div>

          </div>

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Создатель
            </h2>

            <p className="text-gray-300 leading-7">
              Проект создан CIS-тренером, работающим с молодыми игроками и командами.
            </p>

            <p className="text-gray-400 leading-7 mt-4">
              Фокус — развитие сцены и повышение видимости перспективных игроков.
            </p>

            <div className="mt-6 space-y-2">

              <a
                href="https://t.me/LisssTzz1"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:text-orange-300 transition block"
              >
                Telegram → @LisssTzz1
              </a>

              <a
                href="mailto:deadinsidick11@mail.ru"
                className="text-orange-400 hover:text-orange-300 transition block"
              >
                Email → contact
              </a>

            </div>

          </div>

        </div>

      </div>
    </div>
  )
}

export default About