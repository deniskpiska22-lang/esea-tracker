const copy = {
  ru: { show: 'Показать состав', hide: 'Скрыть состав', title: 'Состав команды', profile: 'Профиль команды', loading: 'Загрузка состава…', empty: 'Актуальный состав пока не опубликован.', error: 'Не удалось загрузить состав. Откройте профиль команды или попробуйте ещё раз.' },
  en: { show: 'Show roster', hide: 'Hide roster', title: 'Team lineup', profile: 'Team profile', loading: 'Loading roster…', empty: 'The current roster has not been published yet.', error: 'Could not load the roster. Open the team profile or try again.' },
  de: { show: 'Kader anzeigen', hide: 'Kader ausblenden', title: 'Teamaufstellung', profile: 'Teamprofil', loading: 'Kader wird geladen…', empty: 'Der aktuelle Kader wurde noch nicht veröffentlicht.', error: 'Der Kader konnte nicht geladen werden. Öffne das Teamprofil oder versuche es erneut.' },
  pt: { show: 'Mostrar elenco', hide: 'Ocultar elenco', title: 'Escalação da equipe', profile: 'Perfil da equipe', loading: 'Carregando elenco…', empty: 'O elenco atual ainda não foi publicado.', error: 'Não foi possível carregar o elenco. Abra o perfil da equipe ou tente novamente.' },
  es: { show: 'Mostrar plantilla', hide: 'Ocultar plantilla', title: 'Alineación del equipo', profile: 'Perfil del equipo', loading: 'Cargando plantilla…', empty: 'La plantilla actual aún no se ha publicado.', error: 'No se pudo cargar la plantilla. Abre el perfil del equipo o inténtalo de nuevo.' },
  fr: { show: 'Afficher l’effectif', hide: 'Masquer l’effectif', title: 'Composition de l’équipe', profile: 'Profil de l’équipe', loading: 'Chargement de l’effectif…', empty: 'L’effectif actuel n’a pas encore été publié.', error: 'Impossible de charger l’effectif. Ouvrez le profil de l’équipe ou réessayez.' },
  it: { show: 'Mostra rosa', hide: 'Nascondi rosa', title: 'Formazione della squadra', profile: 'Profilo della squadra', loading: 'Caricamento della rosa…', empty: 'La rosa attuale non è ancora stata pubblicata.', error: 'Impossibile caricare la rosa. Apri il profilo della squadra o riprova.' },
};

export function rankingRosterCopy(language) {
  return copy[language] || copy.en;
}
