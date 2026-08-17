import { create } from 'zustand';
import { dictionaries, Language, Translations } from './translations';

interface I18nStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem('proxypin_language') as Language;
  if (saved && dictionaries[saved]) return saved;
  const sysLang = navigator.language.toLowerCase();
  if (sysLang.startsWith('zh')) return 'zh';
  return 'en';
};

const initialLang = getInitialLanguage();

export const useTranslationStore = create<I18nStore>((set) => ({
  language: initialLang,
  t: dictionaries[initialLang] || dictionaries.en,
  setLanguage: (lang: Language) => {
    localStorage.setItem('proxypin_language', lang);
    set({
      language: lang,
      t: dictionaries[lang] || dictionaries.en,
    });
  },
}));

export const useTranslation = () => {
  const { language, setLanguage, t } = useTranslationStore();
  return { language, setLanguage, t };
};
