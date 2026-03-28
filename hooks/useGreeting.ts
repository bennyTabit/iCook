import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function useGreeting(): string {
  const { t } = useTranslation();
  return useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return t('goodMorning');
    if (h >= 12 && h < 18) return t('goodAfternoon');
    return t('goodEvening');
  }, [t]);
}
