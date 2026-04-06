import { useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { Colors } from '../constants/colors';
import { DarkColors } from '../constants/colorsDark';
import { useThemeStore } from '../store/themeStore';

// A structural type that matches the shape of both Colors and DarkColors
export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  overlay: string;
  shadow: string;
  error: string;
  errorSurface: string;
  errorBorder: string;
  warning: string;
  warningSurface: string;
  warningBorder: string;
  success: string;
  successSurface: string;
  disabled: string;
  disabledSurface: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    disabled: string;
    error: string;
    warning: string;
  };
  difficulty: {
    easy: string;
    medium: string;
    hard: string;
  };
  source: {
    manual: string;
    ocr: string;
    url: string;
    instagram: string;
    ai: string;
  };
  heroGradient: [string, string];
};

export function useThemeColors(): ThemeColors {
  // User's explicit preference (system / light / dark)
  const preference = useThemeStore((s) => s.preference);

  // Live OS colour scheme — only used when preference === 'system'
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && systemScheme === 'dark');

  return (isDark ? DarkColors : Colors) as ThemeColors;
}
