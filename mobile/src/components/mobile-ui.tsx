import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/constants/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Header({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
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
  style?: ViewStyle;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}>
      {loading ? <ActivityIndicator color={secondary ? palette.primary : '#FFFFFF'} /> : null}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{children}</Text>
    </Pressable>
  );
}

export function StatusPill({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'good' | 'warn' }>) {
  return (
    <View style={[styles.pill, tone === 'good' && styles.pillGood, tone === 'warn' && styles.pillWarn]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function Row({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
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
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21 },
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.canvas, flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: 7, paddingBottom: spacing.sm, paddingTop: 4 },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: palette.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35 },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 20, borderWidth: 1, gap: 12, padding: spacing.md },
  button: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.md },
  buttonSecondary: { backgroundColor: palette.surface, borderColor: palette.primary, borderWidth: 1 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  buttonTextSecondary: { color: palette.primary },
  pill: { alignSelf: 'flex-start', backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillGood: { backgroundColor: palette.successSoft },
  pillWarn: { backgroundColor: palette.warningSoft },
  pillText: { color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  rowIcon: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  rowDetail: { color: palette.muted, fontSize: 13, lineHeight: 18 },
});
