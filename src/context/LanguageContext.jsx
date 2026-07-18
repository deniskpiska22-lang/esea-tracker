import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "esea-tracker-language";
const SUPPORTED_LANGUAGES = ["en", "ru"];

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
        "Russian is selected automatically only for Russian-language browsers. English is used for everyone else.",
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
        "Русский выбирается автоматически только для русскоязычных браузеров. Для всех остальных используется английский.",
    },
  },
};

const LanguageContext = createContext(null);

function normalizeLanguage(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().split("-")[0];

  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : null;
}

function detectBrowserLanguage() {
  if (typeof window === "undefined") {
    return "en";
  }

  const browserLanguages = Array.isArray(window.navigator.languages)
    ? window.navigator.languages
    : [window.navigator.language];

  const hasRussianLanguage = browserLanguages.some((language) =>
    String(language).toLowerCase().startsWith("ru"),
  );

  return hasRussianLanguage ? "ru" : "en";
}

function getInitialLanguage() {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const savedLanguage = normalizeLanguage(
      window.localStorage.getItem(STORAGE_KEY),
    );

    if (savedLanguage) {
      return savedLanguage;
    }
  } catch (error) {
    console.warn("Could not read saved language:", error);
  }

  return detectBrowserLanguage();
}

function getNestedTranslation(language, key) {
  const fallbackLanguage = "en";
  const keyParts = String(key).split(".");

  const readValue = (dictionary) =>
    keyParts.reduce((value, part) => value?.[part], dictionary);

  const translatedValue = readValue(translations[language]);

  if (typeof translatedValue === "string") {
    return translatedValue;
  }

  const fallbackValue = readValue(translations[fallbackLanguage]);

  if (typeof fallbackValue === "string") {
    return fallbackValue;
  }

  if (import.meta.env.DEV) {
    console.warn(`Missing translation: "${key}"`);
  }

  return key;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((nextLanguage) => {
    const normalizedLanguage = normalizeLanguage(nextLanguage);

    if (!normalizedLanguage) {
      console.warn(`Unsupported language: "${nextLanguage}"`);
      return;
    }

    setLanguageState(normalizedLanguage);

    try {
      window.localStorage.setItem(STORAGE_KEY, normalizedLanguage);
    } catch (error) {
      console.warn("Could not save language:", error);
    }
  }, []);

  const resetLanguage = useCallback(() => {
    const detectedLanguage = detectBrowserLanguage();

    setLanguageState(detectedLanguage);

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Could not remove saved language:", error);
    }
  }, []);

  const t = useCallback(
    (key) => getNestedTranslation(language, key),
    [language],
  );

  const tr = useCallback(
    (russianText, englishText) =>
      language === "ru" ? russianText : englishText,
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      resetLanguage,
      t,
      tr,
      isRussian: language === "ru",
      isEnglish: language === "en",
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, resetLanguage, setLanguage, t, tr],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>.");
  }

  return context;
}

/*
USAGE

1. Wrap your app in src/main.jsx:

import { LanguageProvider } from "./context/LanguageContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);

2. Use translations in any component:

import { useLanguage } from "../context/LanguageContext";

export default function ProfileMenu() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <button type="button">{t("profileMenu.myProfile")}</button>
      <button type="button">{t("profileMenu.settings")}</button>
      <button type="button">{t("profileMenu.adminPanel")}</button>
      <button type="button">{t("profileMenu.logout")}</button>

      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t("common.language")}
      >
        <option value="en">{t("common.english")}</option>
        <option value="ru">{t("common.russian")}</option>
      </select>
    </div>
  );
}

BEHAVIOR

- A saved manual choice has the highest priority.
- If no choice is saved:
  - ru, ru-RU, ru-BY, etc. -> Russian.
  - every other browser language -> English.
- The manual choice is saved in localStorage.
*/