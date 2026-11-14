import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Header, StatusPill } from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import {
  defects,
  fetchMyReports,
  privateImageSource,
  registerMobileDevice,
  type MyReport,
} from '@/lib/api';
import {
  cacheMyReports,
  getDeviceIdentity,
  listQueuedReports,
  readCachedMyReports,
  type DeviceIdentity,
  type QueuedReport,
} from '@/lib/mobile-data';

const label = (value: string) =>
  defects.find((item) => item.value === value)?.label ??
  value.replaceAll('-', ' ');

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  return parsed.toLocaleString();
}

export default function ActivityScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const galleryWidth = Math.max(260, windowWidth - spacing.md * 2);

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
      const cached = await readCachedMyReports();
      setReports(Array.isArray(cached) ? cached : []);
      setOffline(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            refreshing={refreshing}
            tintColor={palette.primary}
          />
        }>
        <Header
          subtitle="Follow review decisions, repair photos, and work updates."
          title="My reports"
        />

        {offline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              Offline mode · showing cached reports from this device
            </Text>
          </View>
        ) : null}

        {queued.map((report) => (
          <Card key={report.queueId} style={styles.queueCard}>
            <View style={styles.cardTop}>
              <Text style={styles.defect}>{label(report.defect)}</Text>
              <StatusPill tone="warn">Waiting for internet</StatusPill>
            </View>
            <Text style={styles.area}>{report.area}</Text>
            <Text style={styles.meta}>
              Saved {formatTimestamp(report.queuedAt)} · uploads automatically
              when connected
            </Text>
          </Card>
        ))}

        {reports.length === 0 && queued.length === 0 ? (
          <Card style={styles.empty}>
            <View style={styles.emptyIconBadge}>
              <Text style={styles.emptyIcon}>◷</Text>
            </View>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyBody}>
              Submitted and offline road defect reports from this device will
              appear here.
            </Text>
          </Card>
        ) : (
          reports.map((report) => {
            const progressList = report.progressImages ?? [];
            const eventList = report.events ?? [];
            const totalSlides = 1 + progressList.length;

            return (
              <Card key={report.id} style={styles.reportCard}>
                {identity ? (
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.gallery}>
                    <View style={[styles.slide, { width: galleryWidth }]}>
                      <Image
                        alt={`Road report at ${report.area}`}
                        source={privateImageSource(report.imageUrl, identity)}
                        style={[styles.image, { width: galleryWidth }]}
                      />
                      <View style={styles.imageBadgeRow}>
                        <Text style={styles.imageLabel}>Before</Text>
                        {totalSlides > 1 ? (
                          <Text style={styles.slideCount}>
                            1 / {totalSlides}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {progressList.map((image, index) => (
                      <View
                        key={image.id}
                        style={[styles.slide, { width: galleryWidth }]}>
                        <Image
                          alt={`${image.stage} update at ${report.area}`}
                          source={privateImageSource(image.imageUrl, identity)}
                          style={[styles.image, { width: galleryWidth }]}
                        />
                        <View style={styles.imageBadgeRow}>
                          <Text style={styles.imageLabel}>
                            {image.stage === 'after'
                              ? 'After repair'
                              : 'In progress'}
                          </Text>
                          <Text style={styles.slideCount}>
                            {index + 2} / {totalSlides}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.body}>
                  <View style={styles.cardTop}>
                    <Text style={styles.defect}>{label(report.defect)}</Text>
                    <StatusPill
                      tone={
                        report.status === 'repair-completed' ? 'good' : 'warn'
                      }>
                      {label(report.status)}
                    </StatusPill>
                  </View>

                  <View style={styles.areaRow}>
                    <Text style={styles.area}>{report.area}</Text>
                    <View style={styles.idChip}>
                      <Text selectable style={styles.id}>
                        #{report.id.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {eventList.length > 0 ? (
                    <View style={styles.timeline}>
                      {eventList.map((event) => (
                        <View key={event.id} style={styles.event}>
                          <View style={styles.dot} />
                          <View style={styles.eventText}>
                            <Text style={styles.eventTitle}>
                              {event.status
                                ? label(event.status)
                                : label(event.type)}
                            </Text>
                            {event.note ? (
                              <Text style={styles.meta}>{event.note}</Text>
                            ) : null}
                            <Text style={styles.date}>
                              {formatTimestamp(event.createdAt)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: palette.canvas,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  offlineBanner: {
    backgroundColor: palette.warningSoft,
    borderColor: '#e6d09c',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  offlineText: {
    color: '#7a5200',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  queueCard: {
    backgroundColor: palette.warningSoft,
    borderColor: '#e6d09c',
    borderWidth: 1,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 42,
  },
  emptyIconBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 107, 69, 0.1)',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    marginBottom: 4,
    width: 56,
  },
  emptyIcon: {
    color: palette.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: 'center',
  },
  reportCard: {
    overflow: 'hidden',
    padding: 0,
  },
  gallery: {
    width: '100%',
  },
  slide: {
    backgroundColor: '#dfe6dc',
  },
  image: {
    aspectRatio: 16 / 10,
    backgroundColor: palette.border,
  },
  imageBadgeRow: {
    alignItems: 'center',
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 10,
    position: 'absolute',
    right: 10,
  },
  imageLabel: {
    backgroundColor: 'rgba(20, 35, 28, 0.84)',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  slideCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 999,
    color: palette.text,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  body: {
    gap: 10,
    padding: spacing.md,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  defect: {
    color: palette.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  areaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  area: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  idChip: {
    backgroundColor: '#f2ede1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  id: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  date: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  timeline: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
  },
  event: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    backgroundColor: palette.primary,
    borderRadius: 6,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  eventText: {
    flex: 1,
  },
  eventTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
});