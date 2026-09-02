import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Header, StatusPill } from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import { defects, fetchMyReports, privateImageSource, registerMobileDevice, type MyReport } from '@/lib/api';
import {
  cacheMyReports,
  getDeviceIdentity,
  listQueuedReports,
  readCachedMyReports,
  type DeviceIdentity,
  type QueuedReport,
} from '@/lib/mobile-data';

const label = (value: string) => defects.find((item) => item.value === value)?.label ?? value.replaceAll('-', ' ');

export default function ActivityScreen() {
  const galleryWidth = useWindowDimensions().width - spacing.md * 2;
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [reports, setReports] = useState<MyReport[]>([]);
  const [queued, setQueued] = useState<QueuedReport[]>([]);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const device = await getDeviceIdentity();
    setIdentity(device);
    setQueued(await listQueuedReports());
    try {
      await registerMobileDevice(device);
      const remote = await fetchMyReports(device);
      await cacheMyReports(remote);
      setReports(remote);
      setOffline(false);
    } catch {
      setReports(await readCachedMyReports());
      setOffline(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={palette.primary} />}>
        <Header title="My reports" subtitle="Follow review decisions, repair photos and work updates." />
        {offline ? <Text style={styles.offline}>Offline · showing saved information</Text> : null}
        {queued.map((report) => (
          <Card key={report.queueId} style={styles.queueCard}>
            <View style={styles.cardTop}><Text style={styles.defect}>{label(report.defect)}</Text><StatusPill tone="warn">Waiting for internet</StatusPill></View>
            <Text style={styles.area}>{report.area}</Text>
            <Text style={styles.meta}>Saved {new Date(report.queuedAt).toLocaleString()} · uploads automatically when connected</Text>
          </Card>
        ))}
        {reports.length === 0 && queued.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyIcon}>◷</Text><Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyBody}>Submitted and offline reports from this device will appear here.</Text>
          </Card>
        ) : reports.map((report) => (
          <Card key={report.id} style={styles.reportCard}>
            {identity ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
                <View style={[styles.slide, { width: galleryWidth }]}>
                  <Image alt={`Road report at ${report.area}`} source={privateImageSource(report.imageUrl, identity)} style={[styles.image, { width: galleryWidth }]} />
                  <Text style={styles.imageLabel}>Before</Text>
                </View>
                {report.progressImages.map((image) => (
                  <View key={image.id} style={[styles.slide, { width: galleryWidth }]}>
                    <Image alt={`${image.stage} update at ${report.area}`} source={privateImageSource(image.imageUrl, identity)} style={[styles.image, { width: galleryWidth }]} />
                    <Text style={styles.imageLabel}>{image.stage === 'after' ? 'After repair' : 'In progress'}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.body}>
              <View style={styles.cardTop}>
                <Text style={styles.defect}>{label(report.defect)}</Text>
                <StatusPill tone={report.status === 'repair-completed' ? 'good' : 'warn'}>{label(report.status)}</StatusPill>
              </View>
              <Text style={styles.area}>{report.area}</Text>
              <Text selectable style={styles.id}>Report {report.id.slice(0, 8).toUpperCase()}</Text>
              <View style={styles.timeline}>
                {report.events.map((event) => (
                  <View key={event.id} style={styles.event}>
                    <View style={styles.dot} />
                    <View style={styles.eventText}>
                      <Text style={styles.eventTitle}>{event.status ? label(event.status) : label(event.type)}</Text>
                      {event.note ? <Text style={styles.meta}>{event.note}</Text> : null}
                      <Text style={styles.date}>{new Date(event.createdAt).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.canvas, flex: 1 },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  offline: { backgroundColor: palette.warningSoft, borderRadius: 10, color: palette.text, fontSize: 12, fontWeight: '800', padding: 10, textAlign: 'center' },
  queueCard: { backgroundColor: palette.warningSoft },
  empty: { alignItems: 'center', marginTop: 20, paddingVertical: 40 },
  emptyIcon: { color: palette.primary, fontSize: 34 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: palette.muted, fontSize: 14, lineHeight: 20, maxWidth: 280, textAlign: 'center' },
  reportCard: { overflow: 'hidden', padding: 0 },
  gallery: { width: '100%' },
  slide: { backgroundColor: palette.text },
  image: { aspectRatio: 16 / 10, backgroundColor: palette.border },
  imageLabel: { backgroundColor: 'rgba(0,0,0,0.7)', bottom: 8, color: '#fff', fontSize: 11, fontWeight: '800', left: 8, paddingHorizontal: 9, paddingVertical: 5, position: 'absolute' },
  body: { gap: 9, padding: spacing.md },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  defect: { color: palette.text, flex: 1, fontSize: 17, fontWeight: '900' },
  area: { color: palette.text, fontSize: 14, fontWeight: '600' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  date: { color: palette.muted, fontSize: 10, marginTop: 2 },
  id: { color: palette.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  timeline: { gap: 12, marginTop: 5 },
  event: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  dot: { backgroundColor: palette.primary, borderRadius: 6, height: 10, marginTop: 4, width: 10 },
  eventText: { flex: 1 },
  eventTitle: { color: palette.text, fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
});
