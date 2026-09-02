import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Header, PrimaryButton, Row, Screen, StatusPill, textStyles } from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import { getDeviceIdentity, listLocalReports, type DeviceIdentity } from '@/lib/mobile-data';

export default function HomeScreen() {
  const router = useRouter();
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [reportCount, setReportCount] = useState(0);

  useFocusEffect(useCallback(() => {
    void Promise.all([getDeviceIdentity(), listLocalReports()]).then(([device, reports]) => {
      setIdentity(device);
      setReportCount(reports.length);
    });
  }, []));

  return (
    <Screen>
      <Header
        eyebrow="RoadWatch Ghana"
        title="Report a damaged road in minutes."
        subtitle="Capture evidence, attach the exact location, and follow what happens next."
      />

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.mark}><Text style={styles.markText}>RW</Text></View>
          <StatusPill tone="good">Ready to collect</StatusPill>
        </View>
        <Text style={styles.heroTitle}>See a road defect?</Text>
        <Text style={styles.heroBody}>Stand somewhere safe, take one clear road photo, and let the app attach your GPS location.</Text>
        <PrimaryButton onPress={() => router.push('/report')}>Start a new report</PrimaryButton>
      </Card>

      <View style={styles.stats}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{reportCount}</Text>
          <Text style={styles.statLabel}>Reports on this phone</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{identity ? 'Active' : '—'}</Text>
          <Text style={styles.statLabel}>Collector device</Text>
        </Card>
      </View>

      <Text style={textStyles.sectionTitle}>How it works</Text>
      <Card>
        <Row icon={<Text>1</Text>} title="Take a road photo" detail="Use the rear camera or select an existing image." />
        <View style={styles.divider} />
        <Row icon={<Text>2</Text>} title="Capture the location" detail="GPS is used only for the road report you submit." />
        <View style={styles.divider} />
        <Row icon={<Text>3</Text>} title="Follow the update" detail="The public dashboard shows verification and repair progress." />
      </Card>

      {identity ? (
        <Text style={styles.deviceNote}>
          Collector {identity.collectorId} · {identity.manufacturer} {identity.model}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark, gap: spacing.md },
  heroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  mark: { alignItems: 'center', backgroundColor: palette.accent, borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  markText: { color: palette.primaryDark, fontSize: 15, fontWeight: '900' },
  heroTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  heroBody: { color: '#DDE9E5', fontSize: 15, lineHeight: 22 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, minHeight: 110 },
  statNumber: { color: palette.primary, fontSize: 24, fontWeight: '900' },
  statLabel: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  divider: { backgroundColor: palette.border, height: 1, marginLeft: 54 },
  deviceNote: { color: palette.muted, fontSize: 11, textAlign: 'center' },
});
