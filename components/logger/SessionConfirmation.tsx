import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface SessionConfirmationProps {
  visible: boolean;
  userId: string;
  sessionCode: string;
  dynamicHitboxEnabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SessionConfirmation({ 
  visible, 
  userId, 
  sessionCode, 
  dynamicHitboxEnabled,
  onConfirm, 
  onCancel 
}: SessionConfirmationProps) {
  const colorScheme = useColorScheme();

  return (
    <Modal
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
            Ready to Start
          </Text>
          
          <View style={styles.infoContainer}>
            <Text style={[
              styles.infoLabel,
              { color: Colors[colorScheme ?? 'light'].text }
            ]}>
              User ID:
            </Text>
            <Text style={[
              styles.infoValue,
              { color: Colors[colorScheme ?? 'light'].text }
            ]}>
              {userId}
            </Text>
          </View>
          
          <View style={styles.infoContainer}>
            <Text style={[
              styles.infoLabel,
              { color: Colors[colorScheme ?? 'light'].text }
            ]}>
              Session Code:
            </Text>
            <Text style={[
              styles.infoValue,
              { color: Colors[colorScheme ?? 'light'].text }
            ]}>
              {sessionCode}
            </Text>
          </View>
          
          <Text style={[
            styles.instructions,
            { color: Colors[colorScheme ?? 'light'].text }
          ]}>
            Hand the device to the participant to begin the session.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton
              ]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint }
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, styles.confirmButtonText]}>Start Session</Text>
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
    width: '85%',
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
    marginBottom: 16,
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    width: '40%',
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
  },
  instructions: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
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
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
  },
}); 