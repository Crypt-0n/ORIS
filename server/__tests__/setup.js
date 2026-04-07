/**
 * Jest test setup — creates an isolated temp SQLite database for each test run.
 * Sets DB_PATH, JWT_SECRET env vars before any module loads.
 * Registers tsx so TypeScript files (.ts) can be require()'d by Jest.
 */
require('tsx/cjs/api').register();
const path = require('path');
process.env.NODE_ENV = 'test';
const fs = require('fs');
const os = require('os');

// Create a unique ArangoDB test database name
const testArangoDbName = 'oris_test_' + require('crypto').randomUUID().replace(/-/g, '_');

process.env.ARANGO_DB = testArangoDbName;
process.env.ARANGO_URL = process.env.ARANGO_URL || 'http://localhost:8529';
process.env.ARANGO_USER = process.env.ARANGO_USER || 'root';
process.env.ARANGO_PASSWORD = process.env.ARANGO_PASSWORD || 'oris_secret';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '0';

// Store for cleanup in teardown
global.__TEST_ARANGO_DB = testArangoDbName;
