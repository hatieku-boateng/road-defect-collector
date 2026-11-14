import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Card,
  Header,
  PrimaryButton,
  Screen,
  StatusPill,
} from '@/components/mobile-ui';
import { palette, spacing } from '@/constants/theme';
import { defects, type GpsFix, syncQueuedReports } from '@/lib/api';
import {
  getDeviceIdentity,
  listQueuedReports,
  queueReport,
  removeQueuedReport,
  saveLocalReport,
  type DeviceIdentity,
} from '@/lib/mobile-data';

type Photo = { fileName: string; mimeType: string; uri: string };

function showNotice(
  title: string,
  message: string,
  onConfirm?: () => void,
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    onConfirm?.();
    return;
  }
  Alert.alert(
    title,
    message,
    onConfirm ? [{ text: 'View my reports', onPress: onConfirm }] : undefined,
  );
}

async function preparePhoto(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Photo> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > 1920) {
      context.resize({ width: 1920, height: null });
    }
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: 0.84,
      format: SaveFormat.JPEG,
    });
    return {
      fileName: `road-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      uri: result.uri,
    };
  } catch {
    return {
      fileName: asset.fileName ?? `road-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    };
  }
}

export default function ReportScreen() {
  const router = useRouter();
  const [area, setArea] = useState('');
  const [areaFocused, setAreaFocused] = useState(false);
  const [defect, setDefect] =
    useState<(typeof defects)[number]['value']>('pothole');
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [busy, setBusy] = useState<
    'camera' | 'gallery' | 'gps' | 'submit' | null
  >(null);

  useEffect(() => {
    void getDeviceIdentity().then(setIdentity);
  }, []);

  async function receivePhoto(
    result: ImagePicker.ImagePickerResult,
    source: 'camera' | 'gallery',
  ) {
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setBusy(source);
    try {
      setPhoto(await preparePhoto(asset));
      setPrivacyConfirmed(false);
    } catch {
      showNotice(
        'Photo unavailable',
        'The app could not prepare that image. Please try another photo.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function takePhoto() {
    if (busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showNotice(
        'Camera permission needed',
        'Allow camera access in your phone settings to take a road photo.',
      );
      return;
    }
    setBusy('camera');
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      await receivePhoto(result, 'camera');
    } finally {
      setBusy(null);
    }
  }

  async function choosePhoto() {
    if (busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showNotice(
        'Photo permission needed',
        'Allow photo access to select an existing road image.',
      );
      return;
    }
    setBusy('gallery');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      await receivePhoto(result, 'gallery');
    } finally {
      setBusy(null);
    }
  }

  async function captureGps() {
    if (busy) return;
    setBusy('gps');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showNotice(
          'Location permission needed',
          'Allow location access while using the app so this defect can be found.',
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGps({
        accuracy: location.coords.accuracy ?? 0,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch {
      showNotice(
        'Location unavailable',
        'Move to an open area, turn on location services, and try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (busy) return;
    const trimmedArea = area.trim();
    if (
      !identity ||
      !photo ||
      !gps ||
      trimmedArea.length < 3 ||
      !privacyConfirmed
    ) {
      showNotice(
        'Report incomplete',
        'Add the photo, road name, GPS location, and complete the privacy review.',
      );
      return;
    }
    setBusy('submit');
    try {
      await queueReport({
        area: trimmedArea,
        defect,
        gps,
        identity,
        image: photo,
        privacyConfirmed,
      });
      const result = await syncQueuedReports(
        await listQueuedReports(),
        async (queueId, report) => {
          await saveLocalReport(report);
          await removeQueuedReport(queueId);
        },
      );
      setArea('');
      setGps(null);
      setPhoto(null);
      setPrivacyConfirmed(false);

      showNotice(
        result.failed === 0
          ? 'Report submitted'
          : 'Saved for automatic upload',
        result.failed === 0
          ? 'Your report is awaiting verification.'
          : 'There is no reliable connection. The app securely saved your report and will upload it automatically when internet returns.',
        () => router.replace('/activity'),
      );
    } catch (error) {
      showNotice(
        'Could not save report',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  const complete = Boolean(
    identity &&
      photo &&
      gps &&
      area.trim().length >= 3 &&
      privacyConfirmed,
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <Screen>
        <Header
          eyebrow="New report"
          subtitle="Complete each section before submitting."
          title="Capture the road defect"
        />

        <Card>
          <View style={styles.sectionTop}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>01</Text>
            </View>
            <Text style={styles.sectionTitle}>Road photo</Text>
            {photo ? <StatusPill tone="good">Ready</StatusPill> : null}
          </View>

          {photo ? (
            <View style={styles.previewWrap}>
              <Image
                alt="Selected road defect"
                source={{ uri: photo.uri }}
                style={styles.preview}
              />
            </View>
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIconWrap}>
                <Text style={styles.placeholderIcon}>▧</Text>
              </View>
              <Text style={styles.placeholderTitle}>No road photo selected</Text>
              <Text style={styles.placeholderText}>
                Capture a clear photo of the road surface defect
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <PrimaryButton
              disabled={busy !== null && busy !== 'camera'}
              loading={busy === 'camera'}
              onPress={() => void takePhoto()}
              style={styles.halfButton}>
              Take photo
            </PrimaryButton>
            <PrimaryButton
              disabled={busy !== null && busy !== 'gallery'}
              loading={busy === 'gallery'}
              onPress={() => void choosePhoto()}
              secondary
              style={styles.halfButton}>
              Gallery
            </PrimaryButton>
          </View>
        </Card>

        {photo ? (
          <Card style={styles.privacyCard}>
            <View style={styles.sectionTop}>
              <View style={styles.privacyBadge}>
                <Text style={styles.privacyIcon}>✓</Text>
              </View>
              <Text style={styles.sectionTitle}>Privacy review</Text>
            </View>
            <Text style={styles.privacyHelp}>
              For this native pilot, do not submit a photo containing a
              recognisable person, vehicle, bicycle, or number plate. Retake it
              from a safer angle if any are visible.
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyConfirmed }}
              onPress={() => setPrivacyConfirmed((value) => !value)}
              style={styles.checkboxRow}>
              <View
                style={[
                  styles.checkbox,
                  privacyConfirmed && styles.checkboxChecked,
                ]}>
                <Text style={styles.checkmark}>
                  {privacyConfirmed ? '✓' : ''}
                </Text>
              </View>
              <Text style={styles.checkboxText}>
                I confirm no sensitive person or vehicle is visible.
              </Text>
            </Pressable>
          </Card>
        ) : null}

        <Card>
          <View style={styles.sectionTop}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>02</Text>
            </View>
            <Text style={styles.sectionTitle}>Defect details</Text>
          </View>

          <Text style={styles.label}>Suspected defect</Text>
          <View style={styles.chips}>
            {defects.map((item) => {
              const isSelected = defect === item.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={item.value}
                  onPress={() => setDefect(item.value)}
                  style={[styles.chip, isSelected && styles.chipActive]}>
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Road or area name</Text>
          <TextInput
            autoCapitalize="words"
            maxLength={160}
            onBlur={() => setAreaFocused(false)}
            onChangeText={setArea}
            onFocus={() => setAreaFocused(true)}
            placeholder="e.g. Sowutuom Junction or Liberation Road"
            placeholderTextColor={palette.muted}
            style={[styles.input, areaFocused && styles.inputFocused]}
            value={area}
          />
        </Card>

        <Card>
          <View style={styles.sectionTop}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>03</Text>
            </View>
            <Text style={styles.sectionTitle}>Road location</Text>
          </View>

          {gps ? (
            <View style={styles.gpsReady}>
              <View style={styles.gpsCoordsWrap}>
                <Text style={styles.gpsTitle}>GPS coordinates locked</Text>
                <Text selectable style={styles.gpsText}>
                  {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                </Text>
              </View>
              <StatusPill tone="good">±{Math.round(gps.accuracy)} m</StatusPill>
            </View>
          ) : (
            <Text style={styles.help}>
              Stand near the defect in a safe place, then capture the current
              phone location.
            </Text>
          )}

          <PrimaryButton
            disabled={busy !== null && busy !== 'gps'}
            loading={busy === 'gps'}
            onPress={() => void captureGps()}
            secondary>
            {gps ? 'Refresh GPS location' : 'Capture GPS location'}
          </PrimaryButton>
        </Card>

        <Card style={styles.identityCard}>
          <Text style={styles.identityLabel}>DEVICE COLLECTOR ID</Text>
          <Text selectable style={styles.identityValue}>
            {identity?.collectorId ?? 'Generating…'}
          </Text>
          <Text style={styles.identityDevice}>
            {identity
              ? `${identity.manufacturer} · ${identity.model}`
              : 'Reading device details…'}
          </Text>
        </Card>

        <PrimaryButton
          disabled={!complete || (busy !== null && busy !== 'submit')}
          loading={busy === 'submit'}
          onPress={() => void submit()}>
          Submit road report
        </PrimaryButton>

        <Text style={styles.safety}>
          Do not use the app while driving. Stop safely or ask a passenger to
          report.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: '#f0b429',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepText: {
    color: '#2a1d00',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionTitle: {
    color: palette.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  previewWrap: {
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preview: {
    aspectRatio: 4 / 3,
    backgroundColor: '#dfe6dc',
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    aspectRatio: 4 / 3,
    backgroundColor: palette.canvas,
    borderColor: '#d4ccb8',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    padding: 20,
  },
  placeholderIconWrap: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 10,
    width: 52,
  },
  placeholderIcon: {
    color: palette.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  placeholderTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  placeholderText: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfButton: {
    flex: 1,
  },
  privacyCard: {
    backgroundColor: palette.warningSoft,
    borderColor: '#e6d09c',
    borderWidth: 1,
  },
  privacyBadge: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  privacyIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  privacyHelp: {
    color: '#5c4512',
    fontSize: 13,
    lineHeight: 19,
  },
  help: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  checkboxRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: '#e6d09c',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: palette.primary,
    borderRadius: 7,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: palette.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  checkboxText: {
    color: palette.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  label: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  chipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: palette.primaryDark,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#fdfcf8',
    borderColor: '#d4ccb8',
    borderRadius: 14,
    borderWidth: 1.5,
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputFocused: {
    backgroundColor: '#ffffff',
    borderColor: palette.primary,
  },
  gpsReady: {
    alignItems: 'center',
    backgroundColor: palette.successSoft,
    borderColor: 'rgba(11, 107, 69, 0.2)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 13,
  },
  gpsCoordsWrap: {
    flex: 1,
  },
  gpsTitle: {
    color: palette.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  gpsText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  identityCard: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderColor: 'rgba(11, 107, 69, 0.18)',
  },
  identityLabel: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  identityValue: {
    color: palette.primaryDark,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  identityDevice: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  safety: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
});