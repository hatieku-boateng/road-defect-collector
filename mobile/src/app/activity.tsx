import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Header, StatusPill } from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import { defects } from '@/lib/api';
import { listLocalReports, type LocalReport } from '@/lib/mobile-data';

const defectName = (value: string) => defects.find((item) => item.value === value)?.label ?? value;

export default function ActivityScreen() {
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setReports(await listLocalReports());
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={palette.primary} />}>
        <Header title="My reports" subtitle="Reports submitted from this installation of the app." />
        {reports.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyIcon}>◷</Text>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyBody}>Your successful submissions will appear here with their report number.</Text>
          </Card>
        ) : reports.map((report) => (
          <Card key={report.id}>
            <View style={styles.cardTop}>
              <Text style={styles.defect}>{defectName(report.defect)}</Text>
              <StatusPill tone="warn">{report.status}</StatusPill>
            </View>
            <Text style={styles.area}>{report.area}</Text>
            <Text style={styles.meta}>{new Date(report.createdAt).toLocaleString()}</Text>
            <Text selectable style={styles.id}>Report {report.id.slice(0, 8).toUpperCase()}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.canvas, flex: 1 },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  empty: { alignItems: 'center', marginTop: 20, paddingVertical: 40 },
  emptyIcon: { color: palette.primary, fontSize: 34 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: palette.muted, fontSize: 14, lineHeight: 20, maxWidth: 280, textAlign: 'center' },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  defect: { color: palette.text, fontSize: 17, fontWeight: '900' },
  area: { color: palette.text, fontSize: 14, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 12 },
  id: { color: palette.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});
