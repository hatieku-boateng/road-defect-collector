import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/constants/theme';

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const content = <View style={[styles.content, style]}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      {eyebrow ? (
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  children,
  disabled,
  loading,
  onPress,
  secondary = false,
  style,
}: PropsWithChildren<{
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  secondary?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(loading), disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.buttonSecondary : styles.buttonPrimary,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={secondary ? palette.primary : '#FFFFFF'}
          size="small"
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          secondary && styles.buttonTextSecondary,
        ]}>
        {children}
      </Text>
    </Pressable>
  );
}

export type StatusPillTone = 'neutral' | 'good' | 'warn' | 'danger';

export function StatusPill({
  children,
  style,
  tone = 'neutral',
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: StatusPillTone;
}>) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'good' && styles.pillGood,
        tone === 'warn' && styles.pillWarn,
        tone === 'danger' && styles.pillDanger,
        style,
      ]}>
      <View
        style={[
          styles.pillDot,
          tone === 'good' && styles.pillDotGood,
          tone === 'warn' && styles.pillDotWarn,
          tone === 'danger' && styles.pillDotDanger,
        ]}
      />
      <Text
        style={[
          styles.pillText,
          tone === 'good' && styles.pillTextGood,
          tone === 'warn' && styles.pillTextWarn,
          tone === 'danger' && styles.pillTextDanger,
        ]}>
        {children}
      </Text>
    </View>
  );
}

export function Row({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export const textStyles: Record<string, TextStyle> = {
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.canvas,
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: 6,
    paddingBottom: spacing.sm,
    paddingTop: 4,
  },
  eyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  eyebrowBar: {
    backgroundColor: '#f0b429',
    borderRadius: 2,
    height: 3,
    width: 22,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 35,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    gap: 12,
    padding: spacing.md,
    shadowColor: '#14231c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg ?? 20,
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
    elevation: 3,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  buttonSecondary: {
    backgroundColor: palette.surface,
    borderColor: palette.text,
    borderWidth: 1.5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  buttonTextSecondary: {
    color: palette.text,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.primarySoft,
    borderColor: 'rgba(11, 107, 69, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillGood: {
    backgroundColor: palette.successSoft,
    borderColor: 'rgba(11, 107, 69, 0.22)',
  },
  pillWarn: {
    backgroundColor: palette.warningSoft,
    borderColor: 'rgba(183, 121, 31, 0.28)',
  },
  pillDanger: {
    backgroundColor: '#fbe3e0',
    borderColor: 'rgba(200, 55, 45, 0.25)',
  },
  pillDot: {
    backgroundColor: palette.primary,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  pillDotGood: {
    backgroundColor: palette.primary,
  },
  pillDotWarn: {
    backgroundColor: '#b7791f',
  },
  pillDotDanger: {
    backgroundColor: '#c8372d',
  },
  pillText: {
    color: palette.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  pillTextGood: {
    color: palette.primaryDark,
  },
  pillTextWarn: {
    color: '#7a5200',
  },
  pillTextDanger: {
    color: '#8f2a22',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rowDetail: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});