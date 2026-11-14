import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette } from '@/constants/theme';

interface SearchHeaderProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

function showNotice(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  onSearch,
  placeholder = 'Search by area (e.g. Sowutuom, Anyaa)...',
}) => {
  const [query, setQuery] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isBusy = isCheckingUpdate || isInstallingUpdate;

  const handleUpdateInstall = async () => {
    if (isInstallingUpdate) return;
    try {
      setIsInstallingUpdate(true);
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      showNotice(
        'Update Install Failed',
        'Unable to install the update. Please try again later.',
      );
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  const handleUpdateCheck = async () => {
    if (isBusy) return;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return;
    }

    try {
      setIsCheckingUpdate(true);
      if (!Updates.isEnabled) {
        showNotice(
          'Updates Unavailable',
          'Over-the-air updates are not enabled in development or Expo Go builds.',
        );
        return;
      }

      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          'Update Available',
          'A new version of the Ghana Road Collector is ready. Download and restart now?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Install Now',
              onPress: () => {
                void handleUpdateInstall();
              },
            },
          ],
        );
      } else {
        showNotice(
          'Up to Date',
          'You are running the latest version of the app.',
        );
      }
    } catch {
      showNotice(
        'Update Check Failed',
        'Unable to check for updates right now. Please verify your internet connection.',
      );
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleChange = (text: string) => {
    setQuery(text);
    onSearch(text);
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchBar,
          isFocused && styles.searchBarFocused,
        ]}>
        <Ionicons
          color={isFocused ? palette.primary : palette.muted}
          name="search"
          size={18}
          style={styles.searchIcon}
        />
        <TextInput
          accessibilityLabel="Search reports by area"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
          onBlur={() => setIsFocused(false)}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search query"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => handleChange('')}
            style={styles.clearButton}>
            <Ionicons color={palette.muted} name="close-circle" size={18} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel="Check for app updates"
        accessibilityRole="button"
        accessibilityState={{ busy: isBusy, disabled: isBusy }}
        disabled={isBusy}
        onPress={() => {
          void handleUpdateCheck();
        }}
        style={({ pressed }) => [
          styles.installButton,
          isBusy && styles.installButtonDisabled,
          pressed && !isBusy && styles.installButtonPressed,
        ]}>
        {isBusy ? (
          <ActivityIndicator color={palette.primary} size="small" />
        ) : (
          <Ionicons
            color={palette.primary}
            name="cloud-download-outline"
            size={17}
          />
        )}
        <Text style={styles.installText}>
          {isCheckingUpdate
            ? 'Checking…'
            : isInstallingUpdate
              ? 'Updating…'
              : 'Sync'}
        </Text>
      </Pressable>
    </View>
  );
};

export default SearchHeader;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 13,
    shadowColor: '#14231c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  searchBarFocused: {
    borderColor: palette.primary,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    color: palette.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
  },
  installButton: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderColor: 'rgba(11, 107, 69, 0.22)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  installButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  installButtonDisabled: {
    opacity: 0.65,
  },
  installText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});