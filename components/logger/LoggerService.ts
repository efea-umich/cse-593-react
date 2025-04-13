import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import SQLiteLogger, { LogEntry, LogEntryData } from './Logger'; // Assuming SQLiteLogger is in the same directory or path is adjusted

// Interface defining the structure for identifying a session
export interface SessionIdentifier {
  userId: string;
  sessionCode: string;
}

// Interface defining options for creating a logger
export interface LoggerOptions extends SessionIdentifier {}

// Interface for representing a unique session found in the logs
export interface LogSession extends SessionIdentifier {}


class SQLiteLoggerService {
  // Map to hold active logger instances, keyed by "userId-sessionCode"
  private loggers: Map<string, SQLiteLogger> = new Map();
  // Name of the shared database file used by all loggers
  private dbName: string;
  // Reference to the currently active logger instance
  private currentLogger: SQLiteLogger | null = null;
  // Temporary directory for export files
  private tempDirectory: string = `${FileSystem.cacheDirectory}log_exports/`;
  // Expected path to the SQLite database directory
  private sqliteDirectory: string = `${FileSystem.documentDirectory}SQLite/`;

  /**
   * Constructor for the SQLiteLoggerService.
   * @param dbName - The name for the SQLite database file (e.g., 'appLogs.db').
   */
  constructor(dbName: string = 'appLogs.db') {
    // Ensure dbName ends with .db
    this.dbName = dbName.endsWith('.db') ? dbName : `${dbName}.db`;
    console.log(`LoggerService configured to use database: ${this.dbName}`);
    this.ensureTempDirectoryExists(); // Ensure directory for temporary export files exists
  }

  /**
   * Ensures the temporary directory for log exports exists.
   */
  private async ensureTempDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.tempDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.tempDirectory, { intermediates: true });
        console.log(`Created temp directory: ${this.tempDirectory}`);
      }
    } catch (error) {
        console.error('Failed to create temp directory for log exports:', error);
    }
  }

  /**
   * Opens a connection to the shared database. Used for service-level operations.
   * Remember to close it after use if not needed persistently.
   * @returns {Promise<SQLite.SQLiteDatabase | null>} A promise resolving to the database instance or null on error.
   */
  private async openDbConnection(): Promise<SQLite.SQLiteDatabase | null> {
      try {
          // Ensure the SQLite directory exists before trying to open the DB
          // This might be necessary on some platforms or initial runs
          const sqliteDirInfo = await FileSystem.getInfoAsync(this.sqliteDirectory);
          if (!sqliteDirInfo.exists) {
              await FileSystem.makeDirectoryAsync(this.sqliteDirectory, { intermediates: true });
              console.log('Created SQLite directory:', this.sqliteDirectory);
          }
          return await SQLite.openDatabaseAsync(this.dbName);
      } catch (error) {
          console.error(`Failed to open database connection to ${this.dbName}:`, error);
          return null;
      }
  }

  /**
   * Creates a new SQLiteLogger instance for the given user and session,
   * initializes it, stores it, and sets it as the current logger.
   * If a logger for the combination already exists, it returns the existing one.
   * @param {LoggerOptions} options - Contains userId and sessionCode.
   * @returns {Promise<SQLiteLogger | null>} The created or existing logger instance, or null if initialization fails.
   */
  async createLogger(options: LoggerOptions): Promise<SQLiteLogger | null> {
    const key = `${options.userId}-${options.sessionCode}`;

    // Return existing logger if already created
    if (this.loggers.has(key)) {
      console.log(`Returning existing logger for key: ${key}`);
      this.currentLogger = this.loggers.get(key)!;
      // Ensure it's active, maybe re-initialize if needed? Depends on requirements.
      if (!this.currentLogger.isActive()) {
          try {
            await this.currentLogger.initialize(); // Attempt re-initialization if inactive
          } catch (initError) {
             console.error(`Failed to re-initialize logger for key ${key}:`, initError);
             return null; // Return null if re-initialization fails
          }
      }
      return this.currentLogger;
    }

    // Create a new logger instance
    console.log(`Creating new logger for key: ${key}`);
    const logger = new SQLiteLogger(options.userId, options.sessionCode, this.dbName);

    try {
        // Initialize the logger (opens DB, creates table, logs session_start)
        await logger.initialize();

        if (logger.isActive()) {
            // Store and set as current logger
            this.loggers.set(key, logger);
            this.currentLogger = logger;
            return logger;
        } else {
            // Initialization method already logs errors, just indicate failure here
            console.error(`Logger initialization reported as inactive for key: ${key}`);
            return null; // Initialization failed
        }
    } catch (error) {
        console.error(`Error creating or initializing logger for key ${key}:`, error);
        return null;
    }
  }

  /**
   * Retrieves a logger instance.
   * If userId and sessionCode are provided, retrieves that specific logger.
   * Otherwise, returns the currently active logger.
   * @param {string} [userId] - Optional user ID.
   * @param {string} [sessionCode] - Optional session code.
   * @returns {SQLiteLogger | null} The requested logger instance or null if not found.
   */
  getLogger(userId?: string, sessionCode?: string): SQLiteLogger | null {
    if (!userId || !sessionCode) {
      return this.currentLogger;
    }
    const key = `${userId}-${sessionCode}`;
    return this.loggers.get(key) || null;
  }

  /**
   * Retrieves a list of all unique user/session combinations present in the logs.
   * @returns {Promise<LogSession[]>} A promise resolving to an array of unique sessions.
   */
  async getAllSessions(): Promise<LogSession[]> {
    const db = await this.openDbConnection();
    if (!db) return [];

    const sqlSelectDistinct = `SELECT DISTINCT userId, sessionCode FROM logs;`;
    try {
      const results = await db.getAllAsync<LogSession>(sqlSelectDistinct);
      return results;
    } catch (error) {
      // Check if the error is because the table doesn't exist yet
      if (error instanceof Error && (error.message.includes('no such table: logs') || error.message.includes('Query failed'))) {
          console.warn('Log table does not exist or query failed (likely no table). Cannot get sessions.');
          return []; // Return empty array if table isn't created or accessible
      }
      console.error('Failed to get all sessions from database:', error);
      return [];
    } finally {
        // Close the temporary connection if it was opened
        await db.closeAsync().catch(e => console.error("Failed to close DB after getting sessions:", e));
    }
  }

  /**
   * Retrieves all log entries for a specific session.
   * @param {SessionIdentifier} session - The userId and sessionCode to filter by.
   * @param {number} limit - Maximum number of entries to retrieve.
   * @returns {Promise<LogEntry[]>} A promise resolving to an array of log entries.
   */
  async getLogsForSession(session: SessionIdentifier, limit: number = 500): Promise<LogEntry[]> {
     // Note: We still need to open a connection here, as the specific logger
     // instance might not exist or be active in the `loggers` map.
     const db = await this.openDbConnection();
     if (!db) return [];

     const sqlSelect = `
       SELECT * FROM logs
       WHERE userId = ? AND sessionCode = ?
       ORDER BY timestamp DESC
       LIMIT ?;
     `;
     try {
       const results = await db.getAllAsync<LogEntry>(sqlSelect, [session.userId, session.sessionCode, limit]);
       // Optionally parse the 'data' field from JSON string here if needed by the caller
       // return results.map(row => ({ ...row, data: JSON.parse(row.data || '{}') }));
       return results;
     } catch (error) {
       // Check if the error is because the table doesn't exist yet
       if (error instanceof Error && (error.message.includes('no such table: logs') || error.message.includes('Query failed'))) {
           console.warn(`Log table does not exist or query failed (likely no table). Cannot get logs for session ${session.userId}-${session.sessionCode}.`);
           return []; // Return empty array if table isn't created or accessible
       }
       console.error(`Failed to get logs for session ${session.userId}-${session.sessionCode}:`, error);
       return [];
     } finally {
        await db.closeAsync().catch(e => console.error("Failed to close DB after getting logs for session:", e));
     }
  }


  /**
   * Exports the entire SQLite database file by copying it to a temporary location and sharing the copy.
   * This shares ALL logs from ALL sessions.
   * @returns {Promise<void>}
   */
  async exportDatabaseFile(): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
      console.warn('Sharing is not available on this device.');
      // Optionally: Show a message to the user
      return;
    }

    // 1. Define source and destination paths
    const sourceDbPath = `${this.sqliteDirectory}${this.dbName}`;
    const tempDbPath = `${this.tempDirectory}${this.dbName}`; // Use the same name in the temp dir

    try {
      // 2. Check if source database file exists
      const dbFileInfo = await FileSystem.getInfoAsync(sourceDbPath);
      if (!dbFileInfo.exists || dbFileInfo.isDirectory) {
          console.error(`Database file not found at: ${sourceDbPath}`);
          // Optionally: Show error message to user
          return;
      }

      // 3. Copy the database file to the temporary directory
      // This avoids sharing a potentially locked file and isolates the shared copy.
      await FileSystem.copyAsync({
          from: sourceDbPath,
          to: tempDbPath,
      });
      console.log(`Database file copied to temporary location: ${tempDbPath}`);

      // 4. Share the copied temporary file
      await Sharing.shareAsync(tempDbPath, {
        mimeType: 'application/vnd.sqlite3', // Correct MIME type for SQLite DB
        dialogTitle: `Share Log Database (${this.dbName})`,
      });
      console.log(`Sharing initiated for: ${tempDbPath}`);

    } catch (error) {
      console.error(`Failed to export or share database file ${this.dbName}:`, error);
      // Optionally: Show error message to user
    } finally {
      // 5. Clean up the copied temporary file (optional, but good practice)
      // We wait briefly before deleting in case the sharing mechanism needs the file for a moment longer.
      setTimeout(async () => {
          try {
              await FileSystem.deleteAsync(tempDbPath, { idempotent: true });
              console.log(`Deleted temporary database copy: ${tempDbPath}`);
          } catch (deleteError) {
              console.warn(`Failed to delete temporary export file ${tempDbPath}:`, deleteError);
          }
      }, 5000); // Wait 5 seconds before deleting
    }
  }

  /**
   * Deletes all log entries for a specific session from the database.
   * @param {SessionIdentifier} session - The userId and sessionCode to delete logs for.
   * @returns {Promise<boolean>} True if deletion was successful or no rows were affected, false on error.
   */
  async deleteLogsForSession(session: SessionIdentifier): Promise<boolean> {
    const db = await this.openDbConnection();
    if (!db) return false;

    const sqlDelete = `DELETE FROM logs WHERE userId = ? AND sessionCode = ?;`;
    try {
      const result = await db.runAsync(sqlDelete, [session.userId, session.sessionCode]);
      console.log(`Deleted ${result.changes} log entries for session ${session.userId}-${session.sessionCode}.`);

      // Also remove the logger instance from the map if it exists
      const key = `${session.userId}-${session.sessionCode}`;
      if (this.loggers.has(key)) {
          // Close the specific logger instance before removing
          const loggerInstance = this.loggers.get(key);
          // Ensure loggerInstance is not null before calling close
          if (loggerInstance) {
            await loggerInstance.close();
          }
          this.loggers.delete(key);
          console.log(`Removed logger instance from memory for key: ${key}`);
          // If this was the current logger, clear it
          if (this.currentLogger === loggerInstance) {
              this.currentLogger = null;
          }
      }

      return true; // Indicate success
    } catch (error)
     {
        // Check if the error is because the table doesn't exist yet
       if (error instanceof Error && (error.message.includes('no such table: logs') || error.message.includes('Query failed'))) {
           console.warn(`Log table does not exist or query failed (likely no table). Cannot delete logs for session ${session.userId}-${session.sessionCode}.`);
           // Consider returning true as there's nothing to delete
           return true;
       }
      console.error(`Failed to delete logs for session ${session.userId}-${session.sessionCode}:`, error);
      return false; // Indicate failure
    } finally {
        await db.closeAsync().catch(e => console.error("Failed to close DB after deleting logs:", e));
    }
  }

  /**
   * Closes all active logger instances and their database connections.
   * Should be called when the application is shutting down.
   */
  async closeAllLoggers(): Promise<void> {
      console.log("Closing all active logger instances...");
      const closePromises: Promise<void>[] = [];
      this.loggers.forEach(logger => {
          closePromises.push(logger.close());
      });
      try {
          await Promise.all(closePromises);
          this.loggers.clear();
          this.currentLogger = null;
          console.log("All logger instances closed.");
      } catch (error) {
          console.error("Error closing logger instances:", error);
      }
  }
}

// Export a singleton instance of the service
export default new SQLiteLoggerService();