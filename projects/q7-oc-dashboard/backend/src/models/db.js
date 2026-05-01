import Database from 'better-sqlite3';
import { config } from '../core/config.js';

const dbPath = config.databaseUrl.replace('sqlite:///', '').replace('sqlite://', '');
export const db = new Database(dbPath || './q7oc.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
