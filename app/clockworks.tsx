import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

// Import keyboard components
import KeyboardView from '@/components/keyboard/KeyboardView';
import NumberSymbolView from '@/components/keyboard/NumberSymbolView';
import LoggerService from '@/components/logger/LoggerService';
import Logger from '@/components/logger/Logger';

// Simulation of smartwatch screen dimensions (1.7-1.9 inches diagonal)
// Using 44mm Apple Watch dimensions as reference (approximately 184x224 pixels)
const WATCH_WIDTH = 184;
const WATCH_HEIGHT = 224;

// Views for the application
enum AppView {
  INCOMING_MESSAGE = 'incoming_message',
  SUGGESTIONS = 'suggestions',
  SUGGESTION_CONFIRMATION = 'suggestion_confirmation',
  KEYBOARD = 'keyboard',
  NUMBER_SYMBOL = 'number_symbol'
}

export default function ClockworksApp() {
  const colorScheme = useColorScheme();
  const { dynamicHitboxEnabled: paramDynamicHitbox } = useLocalSearchParams();
  const [currentView, setCurrentView] = useState<AppView>(AppView.INCOMING_MESSAGE);
  const [message, setMessage] = useState<string>('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('');
  const [dynamicHitboxEnabled, setDynamicHitboxEnabled] = useState<boolean>(
    paramDynamicHitbox === 'true'
  );
  const [hitboxAffected, setHitboxAffected] = useState<boolean>(false);
  
  // Logger reference
  const loggerRef = useRef<Logger | null>(null);
  
  // Get logger instance from LoggerService
  useEffect(() => {
    // Get the singleton logger instance that was initialized before navigation
    const logger = LoggerService.getLogger();
    
    if (!logger) {
      console.error('Logger not initialized, navigating back to home');
      router.replace('/');
      return;
    }
    
    loggerRef.current = logger;
    logger.log('view_loaded', { view: 'clockworks' });
    
    return () => {
      // Log session end when component unmounts
      if (loggerRef.current) {
        loggerRef.current.log('session_end');
      }
    };
  }, []);

  // Log view transitions
  useEffect(() => {
    if (loggerRef.current) {
      loggerRef.current.log('view_transition', { view: currentView });
    }
  }, [currentView]);

  // Common touch handler with logging
  const handleTap = (action: string, details?: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (loggerRef.current) {
      loggerRef.current.log('tap', { action, ...details });
    }
  };

  // Render the appropriate view based on current state
  const renderContent = () => {
    switch (currentView) {
      case AppView.INCOMING_MESSAGE:
        return <IncomingMessageView 
          onSuggestionSelect={(suggestion) => {
            setSelectedSuggestion(suggestion);
            setCurrentView(AppView.SUGGESTION_CONFIRMATION);
            handleTap('suggestion_select', { suggestion });
          }}
          onKeyboardOpen={() => {
            setCurrentView(AppView.KEYBOARD);
            handleTap('keyboard_open');
          }}
        />;
      
      case AppView.SUGGESTION_CONFIRMATION:
        return <SuggestionConfirmationView 
          suggestion={selectedSuggestion}
          onSend={() => {
            handleTap('send_suggestion', { text: selectedSuggestion });
            // Reset to initial view after sending
            setCurrentView(AppView.INCOMING_MESSAGE);
          }}
          onEdit={() => {
            setMessage(selectedSuggestion);
            setCurrentView(AppView.KEYBOARD);
            handleTap('edit_suggestion', { suggestion: selectedSuggestion });
          }}
          onCancel={() => {
            setCurrentView(AppView.INCOMING_MESSAGE);
            handleTap('cancel_suggestion');
          }}
        />;
      
      case AppView.KEYBOARD:
        return <KeyboardView 
          message={message}
          setMessage={setMessage}
          dynamicHitboxEnabled={dynamicHitboxEnabled}
          setDynamicHitboxEnabled={setDynamicHitboxEnabled}
          hitboxAffected={hitboxAffected}
          setHitboxAffected={setHitboxAffected}
          onToggleNumberSymbol={() => {
            setCurrentView(AppView.NUMBER_SYMBOL);
            handleTap('toggle_number_symbol');
          }}
          onSend={() => {
            handleTap('send_message', { text: message });
            setMessage('');
            setCurrentView(AppView.INCOMING_MESSAGE);
          }}
          onBack={() => {
            setCurrentView(AppView.INCOMING_MESSAGE);
            handleTap('back_from_keyboard');
          }}
          logger={loggerRef.current}
        />;
      
      case AppView.NUMBER_SYMBOL:
        return <NumberSymbolView
          message={message}
          setMessage={setMessage}
          onBackToKeyboard={() => {
            setCurrentView(AppView.KEYBOARD);
            handleTap('back_to_keyboard_from_symbols');
          }}
        />;
      
      default:
        return <IncomingMessageView 
          onSuggestionSelect={(suggestion) => {
            setSelectedSuggestion(suggestion);
            setCurrentView(AppView.SUGGESTION_CONFIRMATION);
            handleTap('suggestion_select', { suggestion });
          }}
          onKeyboardOpen={() => {
            setCurrentView(AppView.KEYBOARD);
            handleTap('keyboard_open');
          }}
        />;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Clockworks',
          headerShown: true,
        }}
      />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      {/* Smartwatch viewport container */}
      <View style={styles.watchContainer}>
        <View style={[
          styles.watchScreen,
          { backgroundColor: Colors[colorScheme ?? 'light'].background }
        ]}>
          {renderContent()}
        </View>
      </View>
    </ThemedView>
  );
}

interface IncomingMessageViewProps {
  onSuggestionSelect: (suggestion: string) => void;
  onKeyboardOpen: () => void;
}

function IncomingMessageView({ onSuggestionSelect, onKeyboardOpen }: IncomingMessageViewProps) {
  const colorScheme = useColorScheme();
  const suggestions = ["Yes", "Sounds good!", "No"];

  return (
    <View style={styles.viewContainer}>
      <ThemedText style={styles.messageText}>
        Hey! Dinner tonight? Thinking chicken?
      </ThemedText>
      
      <View style={styles.suggestionsContainer}>
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.suggestionButton,
              { backgroundColor: Colors[colorScheme ?? 'light'].tint }
            ]}
            onPress={() => onSuggestionSelect(suggestion)}
          >
            <ThemedText style={styles.suggestionText} lightColor="#fff" darkColor="#fff">
              {suggestion}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity
        style={styles.customReplyButton}
        onPress={onKeyboardOpen}
      >
        <ThemedText style={styles.customReplyText}>
          Type a reply
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

interface SuggestionConfirmationViewProps {
  suggestion: string;
  onSend: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

function SuggestionConfirmationView({ 
  suggestion, onSend, onEdit, onCancel 
}: SuggestionConfirmationViewProps) {
  const colorScheme = useColorScheme();
  
  return (
    <View style={styles.viewContainer}>
      <ThemedText style={styles.confirmationText}>
        {suggestion}
      </ThemedText>
      
      <View style={styles.confirmationButtonsContainer}>
        <TouchableOpacity
          style={[
            styles.confirmationButton,
            styles.sendButton,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint }
          ]}
          onPress={onSend}
        >
          <ThemedText style={styles.buttonText} lightColor="#fff" darkColor="#fff">
            Send
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.confirmationButton,
            { borderColor: Colors[colorScheme ?? 'light'].tint }
          ]}
          onPress={onEdit}
        >
          <ThemedText style={styles.buttonText}>
            Edit
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.confirmationButton,
            { borderColor: Colors[colorScheme ?? 'light'].tint }
          ]}
          onPress={onCancel}
        >
          <ThemedText style={styles.buttonText}>
            Cancel
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchContainer: {
    // Border to represent watch case
    borderWidth: 8,
    borderRadius: 24,
    borderColor: '#333',
    // Add shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  watchScreen: {
    width: WATCH_WIDTH,
    height: WATCH_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  viewContainer: {
    flex: 1,
    padding: 8,
  },
  messageText: {
    fontSize: 14,
    marginBottom: 10,
  },
  suggestionsContainer: {
    gap: 6,
    marginBottom: 10,
  },
  suggestionButton: {
    padding: 3,
    borderRadius: 8,
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customReplyButton: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    marginTop: 2,
  },
  customReplyText: {
    fontSize: 14,
  },
  confirmationText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 20,
  },
  confirmationButtonsContainer: {
    gap: 10,
  },
  confirmationButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sendButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 