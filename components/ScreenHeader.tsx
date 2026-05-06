import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';
import { isHebrew } from '../lib/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// ScreenHeader — shared header used by every main tab screen.
//
// SINGLE SOURCE OF TRUTH for header appearance.
// To change the separator:  edit `header.borderBottomWidth` / `header.borderBottomColor`
// To change title size:     edit `title.fontSize` / `title.fontWeight`
// To change spacing:        edit `header.paddingBottom` / `extras.marginTop`
// ─────────────────────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  /** Large primary title */
  title: string;
  /** Smaller description line below the title */
  subtitle?: string;
  /**
   * Optional element pinned to the trailing edge of the title row.
   * Use for icon buttons (add, share, avatar…).
   */
  rightAction?: React.ReactNode;
  /**
   * Optional slot rendered below the title/subtitle block.
   * Use for screen-specific controls: search bar, week-nav, stats pill, etc.
   */
  children?: React.ReactNode;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightAction,
  children,
}: ScreenHeaderProps) {
  const C = useThemeColors();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 10,
          backgroundColor: C.background,
          borderBottomColor: '#C0C0C0',
        },
      ]}
    >
      {/* ── Title row ── */}
      <View style={[styles.titleRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, { color: C.text.primary, textAlign: isHe ? 'right' : 'left' }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: C.text.secondary, textAlign: isHe ? 'right' : 'left' }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? (
          <View style={styles.rightAction}>{rightAction}</View>
        ) : null}
      </View>

      {/* ── Screen-specific extras ── */}
      {children ? <View style={styles.extras}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Change header appearance here — affects every screen ──────────────────
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 2,
  },

  titleRow: {
    alignItems: 'center',
    gap: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 32,
  },

  subtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },

  rightAction: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  extras: {
    marginTop: 14,
  },
});
