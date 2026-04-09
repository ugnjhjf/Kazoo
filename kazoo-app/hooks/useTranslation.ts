import { useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { translations, TranslationKey } from '@/lib/i18n';

export function useTranslation() {
  const { settings } = useAppStore();
  const lang = settings.language;

  const t = useCallback((key: TranslationKey, params?: Record<string, any>): string => {
    let text = translations[lang][key] || translations.en[key] || (key as string);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [lang]);

  return { t, lang };
}
