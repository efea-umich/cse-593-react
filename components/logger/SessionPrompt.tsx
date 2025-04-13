import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface SessionPromptProps {
  visible: boolean;
  onSubmit: (userId: string, sessionCode: string) => void;
  onCancel: () => void;
}

export default function SessionPrompt({ visible, onSubmit, onCancel }: SessionPromptProps) {
  const [userId, setUserId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  const handleSubmit = () => {
    // Simple validation
    if (!userId.trim()) {
      setError('Please enter your user ID');
      return;
    }
    
    if (!sessionCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    // Clear any errors and submit
    setError(null);
    onSubmit(userId.trim(), sessionCode.trim());
    
    // Reset the form for next time
    setUserId('');
    setSessionCode('');
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={[
          styles.modalContent,
          { backgroundColor: Colors[colorScheme ?? 'light'].background }
        ]}>
          <Text style={[
            styles.title,
            { color: Colors[colorScheme ?? 'light'].text }
          ]}>
            Start Session
          </Text>
          
          <Text style={[
            styles.subtitle,
            { color: Colors[colorScheme ?? 'light'].text }
          ]}>
            Enter your information to begin logging
          </Text>
          
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
          
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: '#ccc',
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: '#f9f9f9'
              }
            ]}
            placeholder="User ID"
            placeholderTextColor="#999"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />
          
          <TextInput
            style={[
              styles.input,
              { 
                borderColor: '#ccc',
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: '#f9f9f9'
              }
            ]}
            placeholder="Session Code"
            placeholderTextColor="#999"
            value={sessionCode}
            onChangeText={setSessionCode}
            autoCapitalize="none"
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton
              ]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint }
              ]}
              onPress={handleSubmit}
            >
              <Text style={[styles.buttonText, styles.submitButtonText]}>Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#fff',
  },
  errorText: {
    color: '#ff3b30',
    marginBottom: 12,
    textAlign: 'center',
  },
}); 