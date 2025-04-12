import { StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

// Global state for app settings
export interface AppSettings {
  showHitboxes: boolean;
  dynamicHitboxEnabled: boolean;
  // Add more settings as needed
}

// Default settings
export const defaultSettings: AppSettings = {
  showHitboxes: false,
  dynamicHitboxEnabled: true,
};

// Creating a global variable to store settings
// In a real app, you'd use Context API or Redux
let globalSettings: AppSettings = { ...defaultSettings };

// Function to access settings from other components
export function getAppSettings(): AppSettings {
  return globalSettings;
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>({ ...defaultSettings });

  // Update both local and global settings
  const updateSetting = (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    globalSettings = newSettings;
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'ClockWorks Settings' }} />
      
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">ClockWorks Settings</ThemedText>
          <ThemedText style={styles.description}>
            Configure your watch keyboard preferences
          </ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Keyboard Settings</ThemedText>
          
          <ThemedView style={styles.settingRow}>
            <ThemedView style={styles.settingTextContainer}>
              <ThemedText type="defaultSemiBold">Show Hitboxes</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Visualize the tap areas for each key
              </ThemedText>
            </ThemedView>
            <Switch
              trackColor={{ 
                false: '#767577', 
                true: Colors[colorScheme ?? 'light'].tint 
              }}
              thumbColor="#f4f3f4"
              ios_backgroundColor="#3e3e3e"
              onValueChange={(value) => updateSetting('showHitboxes', value)}
              value={settings.showHitboxes}
            />
          </ThemedView>
          
          <ThemedView style={styles.settingRow}>
            <ThemedView style={styles.settingTextContainer}>
              <ThemedText type="defaultSemiBold">Dynamic Hitboxes</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Automatically adjust key hitboxes based on predicted next character
              </ThemedText>
            </ThemedView>
            <Switch
              trackColor={{ 
                false: '#767577', 
                true: Colors[colorScheme ?? 'light'].tint 
              }}
              thumbColor="#f4f3f4"
              ios_backgroundColor="#3e3e3e"
              onValueChange={(value) => updateSetting('dynamicHitboxEnabled', value)}
              value={settings.dynamicHitboxEnabled}
            />
          </ThemedView>
        </ThemedView>
        
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">About ClockWorks</ThemedText>
          <ThemedText style={styles.description}>
            ClockWorks is a prototype smartwatch keyboard focused on improving typing accuracy through dynamic hitbox adjustment.
          </ThemedText>
        </ThemedView>
        
        <TouchableOpacity 
          style={[
            styles.demoButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint }
          ]}
          onPress={() => {
            // Navigate to the Clockworks demo screen
            router.push('/clockworks');
          }}
        >
          <ThemedText style={styles.demoButtonText} lightColor="#fff" darkColor="#fff">
            Try Keyboard Demo
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
  },
  description: {
    marginTop: 8,
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  demoButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  demoButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
