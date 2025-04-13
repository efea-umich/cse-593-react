import * as SQLite from 'expo-sqlite'; // Use the next gen API for async operations
import { Platform } from 'react-native';

// Define the structure of a log entry (can be adjusted as needed)
export interface LogEntryData {
  [key: string]: any; // Allow flexible data structure
}

export interface LogEntry {
  id?: number; // Optional ID, assigned by the database
  timestamp: string;
  sessionCode: string;
  userId: string;
  message: string;
  data: string; // Store data as a JSON string
}

class SQLiteLogger {
  private userId: string;
  private sessionCode: string;
  private dbName: string;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized: boolean = false;

  /**
   * Constructor for the SQLiteLogger.
   * @param userId - Identifier for the user.
   * @param sessionCode - Identifier for the current session.
   * @param dbName - The name for the SQLite database file (e.g., 'appLogs.db').
   */
  constructor(userId: string, sessionCode: string, dbName: string = 'appLogs.db') {
    this.userId = userId;
    this.sessionCode = sessionCode;
    // Ensure dbName ends with .db, required by expo-sqlite on some platforms
    this.dbName = dbName.endsWith('.db') ? dbName : `${dbName}.db`;
    console.log(`Logger using database: ${this.dbName}`);
  }

  /**
   * Initializes the logger by opening the database and creating the logs table if it doesn't exist.
   * Also logs the session start event.
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   */
  async initialize(): Promise<void> {
    try {
      // Open the database. This creates it if it doesn't exist.
      this.db = await SQLite.openDatabaseAsync(this.dbName);

      // SQL statement to create the logs table if it doesn't already exist.
      // - id: Auto-incrementing primary key.
      // - timestamp: ISO string format for the log time.
      // - sessionCode: Identifier for the session.
      // - userId: Identifier for the user.
      // - message: The main log message string.
      // - data: A JSON string containing additional structured data.
      const sqlCreateTable = `
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          sessionCode TEXT NOT NULL,
          userId TEXT NOT NULL,
          message TEXT NOT NULL,
          data TEXT
        );
      `;

      // Execute the table creation statement.
      await this.db.execAsync(sqlCreateTable);

      // Set initialization flag to true.
      this.isInitialized = true;
      console.log('Logger initialized successfully.');

    } catch (error) {
      console.error('Failed to initialize logger database:', error);
      this.isInitialized = false;
      // Optionally re-throw or handle the error appropriately
      // throw error;
    }
  }

  /**
   * Logs a message and associated data to the SQLite database.
   * @param {string} message - The main log message.
   * @param {LogEntryData} data - Optional structured data associated with the log entry.
   * @returns {Promise<void>} A promise that resolves when the log is written.
   */
  async log(message: string, data: LogEntryData = {}): Promise<void> {
    // Check if the logger is initialized and the database is open.
    if (!this.isInitialized) {
      console.warn('Logger not initialized. Log attempt ignored.');
      return;
    }

    // If database is null or closed, try to reconnect
    if (!this.db) {
      try {
        console.log('Database connection lost, attempting to reconnect...');
        await this.initialize();
        if (!this.isInitialized || !this.db) {
          console.warn('Failed to reconnect to database. Log attempt ignored.');
          return;
        }
      } catch (error) {
        console.error('Failed to reconnect to database:', error);
        return;
      }
    }

    // Prepare the log entry data.
    const timestamp = new Date().toISOString();
    const dataString = JSON.stringify(data); // Serialize data to JSON string

    // SQL statement to insert a new log entry.
    // Uses placeholders (?) for security (prevents SQL injection).
    const sqlInsert = `
      INSERT INTO logs (timestamp, sessionCode, userId, message, data)
      VALUES (?, ?, ?, ?, ?);
    `;

    try {
      // Execute the insert statement with the log data.
      await this.db.runAsync(sqlInsert, [timestamp, this.sessionCode, this.userId, message, dataString]);

      // Also log to console for debugging purposes during development.
      console.log(`[${this.userId}-${this.sessionCode}] ${message}`, data);
    } catch (error) {
      // Check if error is due to closed connection
      if (error instanceof Error && 
          (error.message.includes('closed resource') || 
           error.message.includes('database is closed'))) {
        console.warn('Database connection was closed. Reconnecting for future logs...');
        this.db = null;
        this.isInitialized = false;
        // We'll try to initialize on next log call
      } else {
        console.error('Failed to write log to database:', error);
      }
      // Handle the error appropriately (e.g., retry logic, notify user)
    }
  }

 /**
   * Retrieves recent log entries from the database.
   * @param {number} limit - The maximum number of log entries to retrieve.
   * @returns {Promise<LogEntry[]>} A promise that resolves with an array of log entries.
   */
  async getLogs(limit: number = 100): Promise<LogEntry[]> {
    if (!this.isInitialized) {
      console.warn('Logger not initialized.');
      return [];
    }

    // If database is null or closed, try to reconnect
    if (!this.db) {
      try {
        console.log('Database connection lost, attempting to reconnect...');
        await this.initialize();
        if (!this.isInitialized || !this.db) {
          console.warn('Failed to reconnect to database. Cannot retrieve logs.');
          return [];
        }
      } catch (error) {
        console.error('Failed to reconnect to database:', error);
        return [];
      }
    }

    const sqlSelect = `SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?;`;
    try {
      const results = await this.db.getAllAsync<LogEntry>(sqlSelect, [limit]);
      // Note: The 'data' field will still be a JSON string here.
      // You might want to parse it back to an object if needed:
      // return results.map(row => ({ ...row, data: JSON.parse(row.data) }));
      return results;
    } catch (error) {
      // Check if error is due to closed connection
      if (error instanceof Error && 
          (error.message.includes('closed resource') || 
           error.message.includes('database is closed'))) {
        console.warn('Database connection was closed. Reconnecting for future operations...');
        this.db = null;
        this.isInitialized = false;
        // Return empty array this time
      }
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  /**
   * Closes the database connection.
   * Call this when the logger is no longer needed, e.g., on app shutdown.
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
     if (this.db) {
       try {
         await this.db.closeAsync();
         this.db = null;
         this.isInitialized = false;
         console.log('Logger database closed.');
       } catch (error) {
         console.error('Failed to close logger database:', error);
       }
     }
  }


  /**
   * Gets the name of the database file being used.
   * @returns {string} The database name.
   */
  getDbName(): string {
    return this.dbName;
  }

  /**
   * Gets the user ID associated with this logger instance.
   * @returns {string} The user ID.
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Gets the session code associated with this logger instance.
   * @returns {string} The session code.
   */
  getSessionCode(): string {
    return this.sessionCode;
  }

  /**
   * Checks if the logger has been successfully initialized.
   * @returns {boolean} True if initialized, false otherwise.
   */
  isActive(): boolean {
    return this.isInitialized;
  }
}

export default SQLiteLogger;
