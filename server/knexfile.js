/**
 * Knex.js configuration — Database agnostic.
 * 
 * Parses DATABASE_URL to determine the dialect and load the appropriate driver.
 * Supported protocols:
 *   - sqlite:///path/to/file.db  or  sqlite3:///path/to/file.db
 *   - postgres://user:pass@host:port/db  or  postgresql://...
 *   - mysql://user:pass@host:port/db
 * 
 * Falls back to SQLite at ./database.sqlite if no DATABASE_URL is set.
 */
const path = require('path');

function parseConfig() {
    const url = process.env.DATABASE_URL;

    // Default: SQLite
    if (!url) {
        const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
        return {
            client: 'better-sqlite3',
            connection: { filename: dbPath },
            useNullAsDefault: true,
            pool: { afterCreate: (conn, cb) => {
                conn.pragma('journal_mode = WAL');
                conn.pragma('foreign_keys = ON');
                conn.pragma('synchronous = NORMAL');
                conn.pragma('cache_size = -64000');
                conn.pragma('temp_store = MEMORY');
                cb();
            }},
        };
    }

    const protocol = url.split('://')[0].toLowerCase();

    if (protocol === 'sqlite' || protocol === 'sqlite3') {
        const filePath = url.replace(/^sqlite3?:\/\//, '');
        return {
            client: 'better-sqlite3',
            connection: { filename: filePath },
            useNullAsDefault: true,
            pool: { afterCreate: (conn, cb) => {
                conn.pragma('journal_mode = WAL');
                conn.pragma('foreign_keys = ON');
                conn.pragma('synchronous = NORMAL');
                conn.pragma('cache_size = -64000');
                conn.pragma('temp_store = MEMORY');
                cb();
            }},
        };
    }

    if (protocol === 'postgres' || protocol === 'postgresql') {
        return {
            client: 'pg',
            connection: url,
            pool: { min: 2, max: 10 },
        };
    }

    if (protocol === 'mysql' || protocol === 'mariadb') {
        return {
            client: 'mysql2',
            connection: url,
            pool: { min: 2, max: 10 },
        };
    }

    throw new Error(`Unsupported DATABASE_URL protocol: ${protocol}`);
}

const config = {
    ...parseConfig(),
    migrations: {
        directory: path.join(__dirname, 'migrations'),
    },
    seeds: {
        directory: path.join(__dirname, 'seeds'),
    },
};

module.exports = config;
