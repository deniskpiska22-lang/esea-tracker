/* eslint-disable react-refresh/only-export-components -- context exports its provider and consumer hook */
import { createContext, useCallback, useContext, useMemo } from "react";
import { LANGUAGES, LANGUAGE_CODES, currentLanguage, localizedPath, browserLanguage } from "../i18n/languages.js";
import { translateText } from "../i18n/translate.js";
const STORAGE_KEY = "esea-tracker-language";
const translations = {
  en: {
    common: {
      english: "English",
      russian: "Russian",
      language: "Language",
      save: "Save",
      cancel: "Cancel",
      loading: "Loading...",
    },
    profileMenu: {
      myProfile: "My profile",
      settings: "Settings",
      adminPanel: "Admin panel",
      logout: "Log out",
      administrator: "Administrator",
    },
    profile: {
      title: "My profile",
      editProfile: "Edit profile",
      displayName: "Display name",
      email: "Email",
      avatar: "Avatar",
      updateProfile: "Update profile",
      profileUpdated: "Profile updated",
      updateError: "Could not update profile",
    },
    settings: {
      title: "Settings",
      language: "Language",
      languageDescription:
        "Choose a language using the button in the header. Your choice is saved.",
    },
  },

  ru: {
    common: {
      english: "Английский",
      russian: "Русский",
      language: "Язык",
      save: "Сохранить",
      cancel: "Отмена",
      loading: "Загрузка...",
    },
    profileMenu: {
      myProfile: "Мой профиль",
      settings: "Настройки",
      adminPanel: "Админ-панель",
      logout: "Выйти",
      administrator: "Администратор",
    },
    profile: {
      title: "Мой профиль",
      editProfile: "Редактировать профиль",
      displayName: "Отображаемое имя",
      email: "Электронная почта",
      avatar: "Аватар",
      updateProfile: "Обновить профиль",
      profileUpdated: "Профиль обновлён",
      updateError: "Не удалось обновить профиль",
    },
    settings: {
      title: "Настройки",
      language: "Язык",
      languageDescription:
        "Выберите язык кнопкой в шапке. Выбор сохраняется.",
    },
  },
};


const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  // URL is authoritative, so a shared localized link always opens in its language.
  const language = currentLanguage();
  const setLanguage = useCallback((next) => {
    if (!LANGUAGE_CODES.includes(next)) return;
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Storage may be disabled. */ }
    const destination = localizedPath(window.location.pathname, next) + window.location.search + window.location.hash;
    if (destination !== window.location.pathname + window.location.search + window.location.hash) window.location.assign(destination);
  }, []);
  const resetLanguage = useCallback(() => setLanguage(browserLanguage()), [setLanguage]);
  const tr = useCallback((ru, en) => language === 'ru' && ru !== en ? ru : translateText(en, language), [language]);
  const t = useCallback((key) => {
    const value = String(key).split('.').reduce((obj, part) => obj?.[part], translations[language === 'ru' ? 'ru' : 'en']);
    return translateText(value || key, language);
  }, [language]);
  const context = useMemo(() => ({language, setLanguage, resetLanguage, t, tr,
    isRussian: language === 'ru', isEnglish: language === 'en', supportedLanguages: LANGUAGE_CODES, languages: LANGUAGES,
    locale: LANGUAGES.find(item => item.code === language).locale,
  }), [language, setLanguage, resetLanguage, t, tr]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>.');
  return context;
}
