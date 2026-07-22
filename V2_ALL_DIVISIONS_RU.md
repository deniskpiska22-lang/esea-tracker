# Автоматический импорт всех групп ESEA

Импорт ограничен четырьмя дивизионами:

- Entry
- Intermediate
- Main
- Advanced

Скрипт `scripts/v2/discoverStandingsEntities.js` загружает дерево сезона FACEIT, проходит все регионы, стадии и конференции и автоматически выбирает **все группы** этих дивизионов. UUID групп вручную указывать не нужно.

## Запуск

```bash
npm run v2:discover-entities
npm run v2:sync
```

С профилями, составами и странами игроков:

```bash
npm run v2:sync:profiles
```

## Конфигурация

`scripts/v2/standings.config.json` содержит текущий номер и UUID сезона. При новом сезоне достаточно заменить `season` и `seasonId`. Список групп менять не требуется.

Если FACEIT изменит URL внутреннего endpoint, укажите полный URL или шаблон с `{seasonId}` в `seasonHierarchyUrl` либо через переменную `FACEIT_TEAM_LEAGUES_API`.

Для диагностики загруженное дерево сохраняется в `data/v2/season-hierarchy.json`, а найденные группы — в `data/v2/standings-entities.json`.
