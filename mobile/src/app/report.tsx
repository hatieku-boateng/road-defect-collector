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

import { Card, Header, PrimaryButton, Screen, StatusPill } from '@/components/mobile-ui';
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

async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<Photo> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1920) context.resize({ width: 1920, height: null });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: 0.84, format: SaveFormat.JPEG });
  return { fileName: `road-${Date.now()}.jpg`, mimeType: 'image/jpeg', uri: result.uri };
}

export default function ReportScreen() {
  const router = useRouter();
  const [area, setArea] = useState('');
  const [defect, setDefect] = useState<(typeof defects)[number]['value']>('pothole');
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [busy, setBusy] = useState<'camera' | 'gallery' | 'gps' | 'submit' | null>(null);

  useEffect(() => { void getDeviceIdentity().then(setIdentity); }, []);

  async function receivePhoto(result: ImagePicker.ImagePickerResult) {
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setBusy('camera');
    try {
      setPhoto(await preparePhoto(asset));
      setPrivacyConfirmed(false);
    } catch {
      Alert.alert('Photo unavailable', 'The app could not prepare that image. Please try another photo.');
    } finally {
      setBusy(null);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access in your phone settings to take a road photo.');
      return;
    }
    setBusy('camera');
    try {
      await receivePhoto(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 }));
    } finally {
      setBusy(null);
    }
  }

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access to select an existing road image.');
      return;
    }
    setBusy('gallery');
    try {
      await receivePhoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }));
    } finally {
      setBusy(null);
    }
  }

  async function captureGps() {
    setBusy('gps');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Location permission needed', 'Allow location access while using the app so this defect can be found.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps({
        accuracy: location.coords.accuracy ?? 0,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch {
      Alert.alert('Location unavailable', 'Move to an open area, turn on location services, and try again.');
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!identity || !photo || !gps || area.trim().length < 3 || !privacyConfirmed) {
      Alert.alert('Report incomplete', 'Add the photo, road name, GPS location, and complete the privacy review.');
      return;
    }
    setBusy('submit');
    try {
      await queueReport({ area, defect, gps, identity, image: photo, privacyConfirmed });
      const result = await syncQueuedReports(await listQueuedReports(), async (queueId, report) => {
        await saveLocalReport(report);
        await removeQueuedReport(queueId);
      });
      Alert.alert(
        result.failed === 0 ? 'Report submitted' : 'Saved for automatic upload',
        result.failed === 0
          ? 'Your report is awaiting verification.'
          : 'There is no reliable connection. The app securely saved your report and will upload it automatically when internet returns.',
        [{ text: 'View my reports', onPress: () => router.replace('/activity') }],
      );
      setArea('');
      setGps(null);
      setPhoto(null);
      setPrivacyConfirmed(false);
    } catch (error) {
      Alert.alert('Could not save report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const complete = Boolean(identity && photo && gps && area.trim().length >= 3 && privacyConfirmed);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen>
        <Header eyebrow="New report" title="Capture the road defect" subtitle="Complete each section before submitting." />

        <Card>
          <View style={styles.sectionTop}><Text style={styles.step}>1</Text><Text style={styles.sectionTitle}>Road photo</Text></View>
          {photo ? <Image alt="Selected road defect" source={{ uri: photo.uri }} style={styles.preview} /> : <View style={styles.placeholder}><Text style={styles.placeholderIcon}>▧</Text><Text style={styles.placeholderText}>No road photo selected</Text></View>}
          <View style={styles.buttonRow}>
            <PrimaryButton loading={busy === 'camera'} onPress={() => void takePhoto()} style={styles.halfButton}>Take photo</PrimaryButton>
            <PrimaryButton loading={busy === 'gallery'} onPress={() => void choosePhoto()} secondary style={styles.halfButton}>Gallery</PrimaryButton>
          </View>
        </Card>

        {photo ? (
          <Card style={styles.privacyCard}>
            <View style={styles.sectionTop}><Text style={styles.privacyIcon}>◉</Text><Text style={styles.sectionTitle}>Privacy review</Text></View>
            <Text style={styles.help}>For this native pilot, do not submit a photo containing a recognisable person, vehicle, bicycle, or number plate. Retake it from a safer angle if any are visible.</Text>
            <Pressable onPress={() => setPrivacyConfirmed((value) => !value)} style={styles.checkboxRow}>
              <View style={[styles.checkbox, privacyConfirmed && styles.checkboxChecked]}><Text style={styles.checkmark}>{privacyConfirmed ? '✓' : ''}</Text></View>
              <Text style={styles.checkboxText}>I confirm no sensitive person or vehicle is visible.</Text>
            </Pressable>
          </Card>
        ) : null}

        <Card>
          <View style={styles.sectionTop}><Text style={styles.step}>2</Text><Text style={styles.sectionTitle}>Defect details</Text></View>
          <Text style={styles.label}>Suspected defect</Text>
          <View style={styles.chips}>
            {defects.map((item) => (
              <Pressable key={item.value} onPress={() => setDefect(item.value)} style={[styles.chip, defect === item.value && styles.chipActive]}>
                <Text style={[styles.chipText, defect === item.value && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Road or area name</Text>
          <TextInput
            autoCapitalize="words"
            maxLength={160}
            onChangeText={setArea}
            placeholder="e.g. Liberation Road near Airport Junction"
            placeholderTextColor="#8A9792"
            style={styles.input}
            value={area}
          />
        </Card>

        <Card>
          <View style={styles.sectionTop}><Text style={styles.step}>3</Text><Text style={styles.sectionTitle}>Road location</Text></View>
          {gps ? (
            <View style={styles.gpsReady}>
              <View><Text style={styles.gpsTitle}>Location captured</Text><Text style={styles.gpsText}>{gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}</Text></View>
              <StatusPill tone="good">±{Math.round(gps.accuracy)} m</StatusPill>
            </View>
          ) : <Text style={styles.help}>Stand near the defect in a safe place, then capture the current phone location.</Text>}
          <PrimaryButton loading={busy === 'gps'} onPress={() => void captureGps()} secondary>{gps ? 'Refresh location' : 'Capture GPS location'}</PrimaryButton>
        </Card>

        <Card style={styles.identityCard}>
          <Text style={styles.identityLabel}>DEVICE COLLECTOR ID</Text>
          <Text selectable style={styles.identityValue}>{identity?.collectorId ?? 'Generating…'}</Text>
          <Text style={styles.identityDevice}>{identity ? `${identity.manufacturer} · ${identity.model}` : 'Reading device details…'}</Text>
        </Card>

        <PrimaryButton disabled={!complete} loading={busy === 'submit'} onPress={() => void submit()}>
          Submit road report
        </PrimaryButton>
        <Text style={styles.safety}>Do not use the app while driving. Stop safely or ask a passenger to report.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionTop: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  step: { backgroundColor: palette.primary, borderRadius: 10, color: '#FFFFFF', fontSize: 13, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  sectionTitle: { color: palette.text, flex: 1, fontSize: 17, fontWeight: '900' },
  preview: { aspectRatio: 4 / 3, backgroundColor: palette.canvas, borderRadius: 14, width: '100%' },
  placeholder: { alignItems: 'center', aspectRatio: 4 / 3, backgroundColor: palette.canvas, borderColor: palette.border, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center' },
  placeholderIcon: { color: palette.primary, fontSize: 38 },
  placeholderText: { color: palette.muted, fontSize: 13, marginTop: 8 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  halfButton: { flex: 1 },
  privacyCard: { backgroundColor: palette.warningSoft },
  privacyIcon: { color: palette.primary, fontSize: 22 },
  help: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  checkboxRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  checkbox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: palette.primary, borderRadius: 6, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: palette.primary },
  checkmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  checkboxText: { color: palette.text, flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  label: { color: palette.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: palette.canvas, borderColor: palette.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  chipActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  chipText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: palette.primaryDark },
  input: { backgroundColor: palette.canvas, borderColor: palette.border, borderRadius: 12, borderWidth: 1, color: palette.text, fontSize: 14, minHeight: 52, paddingHorizontal: 14 },
  gpsReady: { alignItems: 'center', backgroundColor: palette.successSoft, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  gpsTitle: { color: palette.success, fontSize: 13, fontWeight: '900' },
  gpsText: { color: palette.muted, fontSize: 11, marginTop: 3 },
  identityCard: { alignItems: 'center', backgroundColor: palette.primarySoft },
  identityLabel: { color: palette.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  identityValue: { color: palette.primaryDark, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  identityDevice: { color: palette.muted, fontSize: 12 },
  safety: { color: palette.muted, fontSize: 11, lineHeight: 16, paddingHorizontal: 20, textAlign: 'center' },
});
