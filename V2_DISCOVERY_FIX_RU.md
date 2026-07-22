# Исправление Discovery 404

FACEIT Open Data API не отдаёт используемые ESEA championship ID через `/data/v4/championships/{id}`.
Поэтому discovery теперь использует тот же рабочий endpoint, что и `scripts/updateMatches.js`:

`https://www.faceit.com/api/team-leagues/v2/matches`

## Быстрый тест без загрузки профилей

```bash
npm run v2:discover -- --max-seeds=5 --max-matches=20 --profiles=false
```

Для более полного поиска:

```bash
npm run v2:discover -- --max-seeds=100 --max-matches=10000 --players=false
```

Полный режим с составами и странами требует `FACEIT_API_KEY` в `.env.local`:

```bash
npm run v2:discover -- --max-seeds=100
```

Результат сохраняется в:

`data/v2/discovery/<championship-id>.json`

Важно: на этом этапе `teams.js` используется только как набор стартовых team ID. Все остальные команды извлекаются из factions найденных матчей.
