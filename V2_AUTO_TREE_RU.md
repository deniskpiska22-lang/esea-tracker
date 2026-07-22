# Автоматическое дерево FACEIT ESEA

Используется реальный внутренний endpoint FACEIT:

```text
GET https://www.faceit.com/api/team-leagues/v2/seasons/tree?entityType=season&entityId=<SEASON_UUID>
```

## Команды

```powershell
npm run v2:discover-entities
npm run v2:sync
```

Принудительно обновить дерево с FACEIT, игнорируя локальный кеш:

```powershell
npm run v2:discover-entities -- --refresh
```

Импортируются только `Regular Season` для дивизионов Entry, Intermediate, Main и Advanced во всех регионах. Запрос standings выполняется с `entityType=stage`; поэтому он охватывает все конференции/группы стадии и включает зарегистрированные команды с 0 матчей.

При смене сезона достаточно поменять `season` и `seasonId` в `scripts/v2/standings.config.json`.
