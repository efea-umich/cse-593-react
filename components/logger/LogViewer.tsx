import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import LoggerService, { LogSession } from './LoggerService';
import { LogEntry } from './Logger';

interface LogViewerProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogViewer({ visible, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogSession | null>(null);
  const [logContent, setLogContent] = useState<LogEntry[]>([]);
  const [viewingLog, setViewingLog] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (visible) {
      loadLogs();
    }
  }, [visible]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const sessions = await LoggerService.getAllSessions();
      setLogs(sessions);
    } catch (error) {
      console.error('Failed to load logs:', error);
      Alert.alert('Error', 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const viewLog = async (session: LogSession) => {
    setLoading(true);
    try {
      const content = await LoggerService.getLogsForSession(session);
      setLogContent(content);
      setSelectedLog(session);
      setViewingLog(true);
    } catch (error) {
      console.error('Failed to view log:', error);
      Alert.alert('Error', 'Failed to view log');
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (session: LogSession) => {
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await LoggerService.deleteLogsForSession(session);
              await loadLogs();
            } catch (error) {
              console.error('Failed to delete log:', error);
              Alert.alert('Error', 'Failed to delete log');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderLogItem = ({ item }: { item: LogSession }) => (
    <View style={[
      styles.logItem,
      { backgroundColor: Colors[colorScheme ?? 'light'].background }
    ]}>
      <View style={styles.logInfo}>
        <Text style={[styles.logUser, { color: Colors[colorScheme ?? 'light'].text }]}>
          User: {item.userId}
        </Text>
        <Text style={[styles.logSession, { color: Colors[colorScheme ?? 'light'].text }]}>
          Session: {item.sessionCode}
        </Text>
      </View>
      
      <View style={styles.logActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => viewLog(item)}
        >
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteLog(item)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Format log content for better display
  const formatLogContent = (content: LogEntry[]) => {
    try {
      return content.map(entry => {
        const timestamp = new Date(entry.timestamp).toLocaleString();
        return `[${timestamp}] ${entry.message}\n${JSON.stringify(entry.data, null, 2)}\n`;
      }).join('\n');
    } catch (e) {
      return content.map(entry => entry.message).join('\n');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? 'light'].background }
      ]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
            {viewingLog ? 'Log Details' : 'Logs'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              if (viewingLog) {
                setViewingLog(false);
                setSelectedLog(null);
                setLogContent([]);
              } else {
                onClose();
              }
            }}
          >
            <Text style={[
              styles.closeButtonText,
              { color: Colors[colorScheme ?? 'light'].tint }
            ]}>
              {viewingLog ? 'Back' : 'Close'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.shareButton}
          onPress={() => {
            LoggerService.exportDatabaseFile();
          }}>
          <Text style={styles.actionButtonText}>Share Logs</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        ) : viewingLog ? (
          <ScrollView 
            style={styles.logContentContainer}
            contentContainerStyle={styles.logContentScrollContainer}
          >
            <Text style={[styles.logContentText, { color: Colors[colorScheme ?? 'light'].text }]}>
              {logContent ? formatLogContent(logContent) : 'No content to display'}
            </Text>
          </ScrollView>
        ) : (
          <>
            {logs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  No logs found
                </Text>
              </View>
            ) : (
              <FlatList
                data={logs}
                renderItem={renderLogItem}
                keyExtractor={(item) => `${item.userId}-${item.sessionCode}`}
                contentContainerStyle={styles.listContent}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  logItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  logInfo: {
    marginBottom: 12,
  },
  logUser: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  logSession: {
    fontSize: 14,
    opacity: 0.7,
  },
  logActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
    marginTop: 12,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  logContentContainer: {
    flex: 1,
  },
  logContentScrollContainer: {
    padding: 16,
  },
  logContentText: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
}); 