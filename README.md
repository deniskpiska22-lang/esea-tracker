# ESEA Tracker — standings trial

Пробная версия импортера команд через внутренний FACEIT endpoint:

```text
GET https://www.faceit.com/api/team-leagues/v2/standings
```

Импортер получает команды напрямую из `standings`, поэтому находит и те команды,
которые ещё не сыграли матч. Основной идентификатор команды:

```text
premade_team_id
```

## Установка в текущий проект

Скопируйте папку `scripts/v2` в корень проекта.

В `package.json` добавьте команду:

```json
"v2:standings": "node scripts/v2/discoverTeamsFromStandings.js"
```

## Первый запуск

Используется тестовая конференция Europe Entry D:

```bash
npm run v2:standings
```

Результат появится здесь:

```text
data/v2/standings-teams.json
```

## Запуск для произвольной сущности

Конференция:

```bash
node scripts/v2/discoverTeamsFromStandings.js \
  --entity-id 55cf8e1b-881e-4573-b991-ea72166992c2 \
  --entity-type conference
```

Стадия:

```bash
node scripts/v2/discoverTeamsFromStandings.js \
  --entity-id c3c65f24-e3e7-4fe3-8004-5bd46c8f7c79 \
  --entity-type stage
```

## userId

Сначала запускайте без `userId`. Он нужен только для поля `user_team_standing`,
а не для общего массива команд.

Если FACEIT потребует его, можно передать:

```bash
FACEIT_USER_ID=0871c9f5-cacc-460e-a44a-c85bb414ad5 \
npm run v2:standings
```

или:

```bash
node scripts/v2/discoverTeamsFromStandings.js \
  --entity-id 55cf8e1b-881e-4573-b991-ea72166992c2 \
  --entity-type conference \
  --user-id 0871c9f5-cacc-460e-a44a-c85bb414ad5
```

## Что сохраняется

Для каждой команды:

- `team_id` / `premade_team_id`;
- `league_team_id`;
- название, короткое имя и логотип;
- `country_code`;
- число игроков;
- победы, поражения, очки и позиция;
- источник: регион, дивизион, стадия и конференция.

## Следующий этап

После успешной проверки этот модуль можно подключить к полному pipeline:

```text
season → stages/conferences → standings → teams → rosters → players → matches
```
