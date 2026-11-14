import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Header,
  PrimaryButton,
  Row,
  Screen,
  StatusPill,
  textStyles,
} from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import {
  getDeviceIdentity,
  listLocalReports,
  listQueuedReports,
  type DeviceIdentity,
} from '@/lib/mobile-data';

export default function HomeScreen() {
  const router = useRouter();
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [reportCount, setReportCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void Promise.all([
        getDeviceIdentity().catch(() => null),
        listLocalReports().catch(() => []),
        listQueuedReports().catch(() => []),
      ]).then(([device, localReports, queuedReports]) => {
        if (!active) return;
        if (device) setIdentity(device);
        const safeLocal = Array.isArray(localReports) ? localReports.length : 0;
        const safeQueued = Array.isArray(queuedReports)
          ? queuedReports.length
          : 0;
        setReportCount(safeLocal + safeQueued);
        setQueuedCount(safeQueued);
      });

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen>
      <Header
        eyebrow="Ghana Road Defect"
        subtitle="Capture GPS-backed evidence, protect bystander privacy, and track repair progress."
        title="Report a damaged road in minutes."
      />

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.brandCluster}>
            <View style={styles.mark}>
              <Text style={styles.markText}>GR</Text>
              <View style={styles.markRoadLine} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Field Collector</Text>
              <Text style={styles.brandSub}>Monitoring Subsystem</Text>
            </View>
          </View>
          <StatusPill tone={queuedCount > 0 ? 'warn' : 'good'}>
            {queuedCount > 0 ? `${queuedCount} queued` : 'Collection live'}
          </StatusPill>
        </View>

        <Text style={styles.heroTitle}>See a road surface defect?</Text>
        <Text style={styles.heroBody}>
          Stand somewhere safe, take one clear road photo, and let the app
          attach your exact GPS coordinates for engineering review.
        </Text>

        <View style={styles.heroActions}>
          <PrimaryButton
            onPress={() => router.push('/report')}
            style={styles.goldCtaButton}>
            <Text style={styles.goldCtaText}>+ Start a new report</Text>
          </PrimaryButton>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/public')}
            style={({ pressed }) => [
              styles.secondaryHeroLink,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.secondaryHeroLinkText}>
              Explore verified public reports →
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroRoadStripe} />
      </Card>

      <View style={styles.stats}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/activity')}
          style={({ pressed }) => [
            styles.statPressable,
            pressed && styles.pressed,
          ]}>
          <Card style={styles.statCard}>
            <View style={styles.statHeaderRow}>
              <Text style={styles.statEyebrow}>MY SUBMISSIONS</Text>
              <View style={styles.statDot} />
            </View>
            <Text style={styles.statNumber}>{reportCount}</Text>
            <Text style={styles.statLabel}>
              {queuedCount > 0
                ? `${queuedCount} waiting for internet`
                : 'Reports recorded on this device'}
            </Text>
          </Card>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/report')}
          style={({ pressed }) => [
            styles.statPressable,
            pressed && styles.pressed,
          ]}>
          <Card style={styles.statCard}>
            <View style={styles.statHeaderRow}>
              <Text style={styles.statEyebrow}>COLLECTOR ID</Text>
              <View
                style={[
                  styles.statDot,
                  {
                    backgroundColor: identity
                      ? palette.primary
                      : palette.warning,
                  },
                ]}
              />
            </View>
            <Text numberOfLines={1} style={styles.statCode}>
              {identity ? identity.collectorId : 'Active'}
            </Text>
            <Text numberOfLines={1} style={styles.statLabel}>
              {identity
                ? `${identity.manufacturer} ${identity.model}`
                : 'Ready for field capture'}
            </Text>
          </Card>
        </Pressable>
      </View>

      <Text style={textStyles.sectionTitle}>Operational workflow</Text>
      <Card>
        <Row
          detail="Use the rear camera or select an existing road image with no people or number plates visible."
          icon={<Text style={styles.stepIconText}>01</Text>}
          title="Capture road evidence"
        />
        <View style={styles.divider} />
        <Row
          detail="High-accuracy GPS coordinates are attached automatically—even when working offline."
          icon={<Text style={styles.stepIconText}>02</Text>}
          title="Lock GPS coordinates"
        />
        <View style={styles.divider} />
        <Row
          detail="Administrators verify your report and publish repair milestones to the public dashboard."
          icon={<Text style={styles.stepIconText}>03</Text>}
          title="Follow verification & repair"
        />
      </Card>

      {identity ? (
        <View style={styles.deviceFooter}>
          <Text selectable style={styles.deviceNote}>
            Collector {identity.collectorId} · {identity.manufacturer}{' '}
            {identity.model}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: palette.primaryDark,
    borderColor: palette.primaryDark,
    gap: spacing.md,
    overflow: 'hidden',
    paddingBottom: 22,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  brandCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    width: 44,
  },
  markText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  markRoadLine: {
    backgroundColor: palette.accent,
    borderRadius: 2,
    bottom: 6,
    height: 2.5,
    position: 'absolute',
    width: 22,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  brandSub: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  heroBody: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 14,
    lineHeight: 21,
  },
  heroActions: {
    gap: 10,
    marginTop: 2,
  },
  goldCtaButton: {
    backgroundColor: palette.accent,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
  },
  goldCtaText: {
    color: '#2a1d00',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryHeroLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryHeroLinkText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  heroRoadStripe: {
    backgroundColor: 'rgba(240, 180, 41, 0.55)',
    borderRadius: 2,
    bottom: 8,
    height: 3,
    left: 20,
    position: 'absolute',
    right: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statPressable: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    gap: 6,
    justifyContent: 'space-between',
    minHeight: 116,
  },
  statHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statEyebrow: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statDot: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  statNumber: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statCode: {
    color: palette.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  stepIconText: {
    color: palette.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  divider: {
    backgroundColor: palette.border,
    height: 1,
    marginLeft: 56,
  },
  deviceFooter: {
    alignItems: 'center',
    paddingTop: 4,
  },
  deviceNote: {
    backgroundColor: '#f2ede1',
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 6,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});