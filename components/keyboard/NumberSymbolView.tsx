import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAppSettings } from '@/app/(tabs)/index';

// Number and symbol keys layout
const symbolRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'],
  ['!', '"', '\'', ':', ';', '/', '?', '.', ',', '⌫'],
];

interface NumberSymbolViewProps {
  message: string;
  setMessage: (text: string) => void;
  onBackToKeyboard: () => void;
}

export default function NumberSymbolView({
  message,
  setMessage,
  onBackToKeyboard,
}: NumberSymbolViewProps) {
  const colorScheme = useColorScheme();
  const [showHitboxes, setShowHitboxes] = useState(false);
  
  // Load settings from the global settings
  useEffect(() => {
    const settings = getAppSettings();
    setShowHitboxes(settings.showHitboxes);
  }, []);
  
  // Log every key press with coordinates
  const logKeyPress = (key: string, x: number, y: number) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'key_press',
      details: {
        key,
        position: { x, y },
        view: 'number_symbol'
      }
    }));
  };

  // Handle key press
  const handleKeyPress = (key: string, e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Extract tap coordinates
    const tapX = e.nativeEvent.locationX;
    const tapY = e.nativeEvent.locationY;
    
    // Log the key press
    logKeyPress(key, tapX, tapY);

    // Handle special keys
    if (key === '⌫') {
      // Handle backspace
      if (message.length > 0) {
        setMessage(message.slice(0, -1));
      }
      return;
    }
    
    // Add the character to the message
    setMessage(message + key);
  };

  return (
    <View style={styles.container}>
      {/* Text input preview area */}
      <View style={styles.inputPreview}>
        <ThemedText style={styles.inputText} numberOfLines={1} ellipsizeMode="head">
          {message}
        </ThemedText>
      </View>
      
      {/* Symbol keyboard */}
      <View style={styles.keyboardContainer}>
        {/* Symbol rows */}
        {symbolRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyboardRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.key,
                  key === '⌫' && styles.wideKey,
                  // Add visual hitbox indicators when showHitboxes is true
                  showHitboxes && { 
                    borderWidth: 1,
                    borderColor: 'blue',
                  }
                ]}
                onPress={(e) => handleKeyPress(key, e)}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        
        {/* Bottom row with return to keyboard button */}
        <View style={styles.keyboardRow}>
          <TouchableOpacity
            style={[
              styles.key, 
              styles.specialKey,
              showHitboxes && { 
                borderWidth: 1,
                borderColor: 'blue',
              }
            ]}
            onPress={onBackToKeyboard}
          >
            <Text style={styles.keyText}>ABC</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.key, 
              styles.spaceKey,
              showHitboxes && { 
                borderWidth: 1,
                borderColor: 'blue',
              }
            ]}
            onPress={(e) => handleKeyPress(' ', e)}
          >
            <Text style={styles.keyText}>space</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.key, 
              styles.specialKey,
              showHitboxes && { 
                borderWidth: 1,
                borderColor: 'blue',
              }
            ]}
            onPress={onBackToKeyboard}
          >
            <Text style={styles.keyText}>Return</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 4,
  },
  inputPreview: {
    height: 36,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 4,
    marginBottom: 8,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 14,
  },
  keyboardContainer: {
    flex: 1,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  key: {
    width: 18,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
  },
  keyText: {
    fontSize: 10,
  },
  wideKey: {
    width: 30,
  },
  spaceKey: {
    flex: 2,
    backgroundColor: '#d0d0d0',
  },
  specialKey: {
    flex: 1,
    backgroundColor: '#d0d0d0',
  },
}); 