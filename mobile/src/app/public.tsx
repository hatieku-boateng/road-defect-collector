import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import {
  Card,
  Header,
  PrimaryButton,
  StatusPill,
} from '@/components/mobile-ui';
import { SearchHeader } from '@/components/SearchHeader';
import { palette, spacing } from '@/constants/theme';
import { defects, fetchPublicReports, type PublicReport } from '@/lib/api';

const label = (value: string) =>
  defects.find((item) => item.value === value)?.label ??
  value.replaceAll('-', ' ');

const canDirect = (report: PublicReport) =>
  typeof report.latitude === 'number' &&
  Number.isFinite(report.latitude) &&
  typeof report.longitude === 'number' &&
  Number.isFinite(report.longitude);

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  return parsed.toLocaleDateString();
}

export default function PublicScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const galleryWidth = Math.max(260, windowWidth - spacing.md * 2);

  const [reports, setReports] = useState<PublicReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError('');
      const data = await fetchPublicReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Reports are temporarily unavailable.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const filteredReports = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return reports;
    return reports.filter((report) => {
      const areaMatch = report.area?.toLowerCase().includes(normalized);
      const defectMatch = label(report.defect)
        .toLowerCase()
        .includes(normalized);
      const statusMatch = label(report.status)
        .toLowerCase()
        .includes(normalized);
      return Boolean(areaMatch || defectMatch || statusMatch);
    });
  }, [reports, searchQuery]);

  function directions(report: PublicReport) {
    if (!canDirect(report)) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
    void Linking.openURL(url).catch(() => {});
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <SearchHeader onSearch={setSearchQuery} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void load(true);
            }}
            refreshing={refreshing}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        <Header
          eyebrow="Public dashboard"
          subtitle="Follow verified defects from report through repair completion."
          title="Reported roads"
        />

        {loading && reports.length === 0 ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.loaderText}>Loading verified road reports…</Text>
          </View>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load reports</Text>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton
              onPress={() => {
                void load(false);
              }}
              secondary>
              Try again
            </PrimaryButton>
          </Card>
        ) : null}

        {!loading && !error && filteredReports.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconBadge}>
              <Text style={styles.emptyIcon}>◎</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim()
                ? 'No matching road reports'
                : 'No active reports'}
            </Text>
            <Text style={styles.emptyBody}>
              {searchQuery.trim()
                ? `No verified reports matched "${searchQuery.trim()}". Try searching another area or defect type.`
                : 'New verified road defect reports will appear here.'}
            </Text>
          </Card>
        ) : null}

        {filteredReports.map((report) => {
          const progressList = report.progressImages ?? [];
          const totalSlides = 1 + progressList.length;

          return (
            <Card key={report.id} style={styles.reportCard}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.gallery}>
                <View style={[styles.slide, { width: galleryWidth }]}>
                  <Image
                    alt={`Road report at ${report.area}`}
                    source={{ uri: report.imageUrl }}
                    style={[styles.image, { width: galleryWidth }]}
                  />
                  <View style={styles.imageBadgeRow}>
                    <Text style={styles.imageLabel}>Before</Text>
                    {totalSlides > 1 ? (
                      <Text style={styles.slideCount}>1 / {totalSlides}</Text>
                    ) : null}
                  </View>
                </View>

                {progressList.map((image, index) => (
                  <View
                    key={image.id}
                    style={[styles.slide, { width: galleryWidth }]}>
                    <Image
                      alt={`${image.stage} update at ${report.area}`}
                      source={{ uri: image.imageUrl }}
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

              <View style={styles.body}>
                <View style={styles.reportTop}>
                  <Text style={styles.defect}>{label(report.defect)}</Text>
                  <StatusPill
                    tone={
                      report.status === 'repair-completed' ? 'good' : 'warn'
                    }>
                    {label(report.status)}
                  </StatusPill>
                </View>

                <Text style={styles.area}>{report.area}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    Reported {formatDate(report.createdAt)} ·{' '}
                    {report.source === 'drone-ai'
                      ? 'Drone AI survey'
                      : 'Field collector'}
                  </Text>
                </View>

                {canDirect(report) ? (
                  <PrimaryButton
                    onPress={() => directions(report)}
                    secondary
                    style={styles.directionsBtn}>
                    Show me directions
                  </PrimaryButton>
                ) : (
                  <View style={styles.pendingBox}>
                    <Text style={styles.pending}>
                      Directions become available after geospatial verification.
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          );
        })}
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
  loaderWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
  },
  loaderText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: palette.dangerSoft,
    borderColor: 'rgba(200, 55, 45, 0.25)',
    borderWidth: 1,
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  errorText: {
    color: '#8f2a22',
    fontSize: 13,
    lineHeight: 19,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 42,
  },
  emptyIconBadge: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    marginBottom: 4,
    width: 56,
  },
  emptyIcon: {
    color: palette.primary,
    fontSize: 26,
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
    maxWidth: 290,
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
  reportTop: {
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
  area: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  directionsBtn: {
    marginTop: 4,
  },
  pendingBox: {
    backgroundColor: '#f2ede1',
    borderRadius: 12,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pending: {
    color: palette.muted,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
  },
});