import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Header, PrimaryButton, StatusPill } from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import { defects, fetchPublicReports, type PublicReport } from '@/lib/api';

const label = (value: string) => defects.find((item) => item.value === value)?.label ?? value.replaceAll('-', ' ');
const canDirect = (report: PublicReport) => report.latitude !== null && report.longitude !== null;

export default function PublicScreen() {
  const galleryWidth = useWindowDimensions().width - spacing.md * 2;
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      setReports(await fetchPublicReports());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Reports are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function directions(report: PublicReport) {
    if (!canDirect(report)) return;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={palette.primary} />}>
        <Header eyebrow="Public dashboard" title="Reported roads" subtitle="Follow verified defects from report through repair completion." />
        {loading && reports.length === 0 ? <ActivityIndicator color={palette.primary} size="large" /> : null}
        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load reports</Text>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton onPress={() => { setLoading(true); void load(); }} secondary>Try again</PrimaryButton>
          </Card>
        ) : null}
        {!loading && !error && reports.length === 0 ? (
          <Card style={styles.emptyCard}><Text style={styles.emptyTitle}>No active reports</Text><Text style={styles.meta}>New verified road reports will appear here.</Text></Card>
        ) : null}
        {reports.map((report) => (
          <Card key={report.id} style={styles.reportCard}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
              <View style={[styles.slide, { width: galleryWidth }]}>
                <Image alt={`Road report at ${report.area}`} source={{ uri: report.imageUrl }} style={[styles.image, { width: galleryWidth }]} />
                <Text style={styles.imageLabel}>Before</Text>
              </View>
              {report.progressImages.map((image) => (
                <View key={image.id} style={[styles.slide, { width: galleryWidth }]}>
                  <Image alt={`${image.stage} update at ${report.area}`} source={{ uri: image.imageUrl }} style={[styles.image, { width: galleryWidth }]} />
                  <Text style={styles.imageLabel}>{image.stage === 'after' ? 'After repair' : 'In progress'}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.reportTop}>
              <Text style={styles.defect}>{label(report.defect)}</Text>
              <StatusPill tone={report.status === 'repair-completed' ? 'good' : 'warn'}>{label(report.status)}</StatusPill>
            </View>
            <Text style={styles.area}>{report.area}</Text>
            <Text style={styles.meta}>Reported {new Date(report.createdAt).toLocaleDateString()} · {report.source === 'drone-ai' ? 'Drone survey' : 'Public collector'}</Text>
            {canDirect(report) ? <PrimaryButton onPress={() => directions(report)} secondary>Show me directions</PrimaryButton> : <Text style={styles.pending}>Directions become available after verification.</Text>}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.canvas, flex: 1 },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  errorCard: { backgroundColor: palette.dangerSoft },
  errorTitle: { color: palette.danger, fontSize: 16, fontWeight: '900' },
  errorText: { color: palette.muted, fontSize: 13 },
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  reportCard: { overflow: 'hidden', padding: 0, paddingBottom: spacing.md },
  gallery: { width: '100%' },
  slide: { backgroundColor: palette.text },
  image: { aspectRatio: 16 / 10, backgroundColor: palette.border },
  imageLabel: { backgroundColor: 'rgba(0,0,0,0.7)', bottom: 8, color: '#fff', fontSize: 11, fontWeight: '800', left: 8, paddingHorizontal: 9, paddingVertical: 5, position: 'absolute' },
  reportTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  defect: { color: palette.text, fontSize: 17, fontWeight: '900' },
  area: { color: palette.text, fontSize: 14, fontWeight: '700', paddingHorizontal: spacing.md },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 17, paddingHorizontal: spacing.md },
  pending: { color: palette.muted, fontSize: 12, fontStyle: 'italic', paddingHorizontal: spacing.md },
});
