import React from "react"

function About() {
  return (
    <div className="bg-[#0f1419] min-h-screen text-white px-4 md:px-8 py-10">

      <div className="max-w-5xl mx-auto">

        {/* TITLE */}
        <div className="mb-12">

          <h1 className="text-4xl md:text-5xl font-bold text-orange-500 mb-4">
            О проекте Esea Tracker
          </h1>

          <p className="text-gray-400 text-lg max-w-3xl leading-8">
            Независимая рейтинговая платформа, посвящённая CIS-командам,
            выступающим в лигах ESEA. Цель проекта — освещать молодые
            таланты, отслеживать развитие команд и создать единый хаб
            для полупрофессиональной сцены СНГ.
          </p>

        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* PROJECT */}
          <div className="bg-[#1a1f26] border border-gray-800 rounded-2xl p-6">

            <h2 className="text-2xl font-semibold mb-4 text-orange-400">
              Проект
            </h2>

            <p className="text-gray-300 leading-7">
              CIS ESEA Rankings был создан для того, чтобы дать больше
              внимания командам вне тир-1 сцены. Многие сильные составы
              из Advanced, Main, Intermediate и Entry практически не
              получают достаточного медийного освещения, несмотря на
              хорошие результаты и перспективных игроков.
            </p>

            <p className="text-gray-300 leading-7 mt-4">
              Система рейтинга учитывает результаты матчей,
              стабильность, уровень дивизиона и текущую форму команды,
              формируя динамический рейтинг CIS-региона.
            </p>

          </div>

          {/* FEATURES */}
          <div className="bg-[#1a1f26] border border-gray-800 rounded-2xl p-6">

            <h2 className="text-2xl font-semibold mb-4 text-orange-400">
              Возможности
            </h2>

            <ul className="space-y-3 text-gray-300 leading-7">
              <li>• Рейтинг CIS команд ESEA</li>
              <li>• Страницы команд с составом и матчами</li>
              <li>• Отслеживание дивизионов</li>
              <li>• Социальные сети команд</li>
              <li>• Полная адаптация под телефон</li>
              <li>• Регулярные обновления рейтинга</li>
            </ul>

          </div>

          {/* RANKING SYSTEM */}
          <div className="bg-[#1a1f26] border border-gray-800 rounded-2xl p-6">

            <h2 className="text-2xl font-semibold mb-4 text-orange-400">
              Система рейтинга
            </h2>

            <div className="space-y-5 text-gray-300">

              <div>
                <p className="font-semibold text-white mb-1">
                  Advanced
                </p>

                <p>
                  Максимальный множитель очков и высокий вес матчей.
                </p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">
                  Main
                </p>

                <p>
                  Высокий множитель и бонус за стабильные результаты.
                </p>
              </div>

              <div>
                <p className="font-semibold text-white mb-1">
                  Intermediate / Entry
                </p>

                <p>
                  Основной акцент на винрейт и прогресс команды.
                </p>
              </div>

            </div>

          </div>

          {/* CREATOR */}
          <div className="bg-[#1a1f26] border border-gray-800 rounded-2xl p-6">

            <h2 className="text-2xl font-semibold mb-4 text-orange-400">
              Создатель
            </h2>

            <p className="text-gray-300 leading-7">
              Проект создан CIS-тренером, который занимается развитием
              молодых игроков и стремится повысить узнаваемость
              полупрофессиональной сцены.
            </p>

            <p className="text-gray-300 leading-7 mt-4">
              Сайт активно развивается, и в будущем планируется ещё
              больше функций, статистики и улучшений интерфейса.
            </p>

<div className="flex flex-col gap-2">
  
  <a
    href="https://t.me/LisssTzz1"
    target="_blank"
    rel="noreferrer"
    className="text-orange-400 hover:text-orange-300 transition"
  >
    TG - @LisssTzz1
  </a>

  <a
    href="mailto:deadinsidick11@mail.ru"
    className="text-orange-400 hover:text-orange-300 transition"
  >
    Mail - deadinsidick11@mail.ru
  </a>

</div>

          </div>

        </div>

      </div>

    </div>
  )
}

export default About