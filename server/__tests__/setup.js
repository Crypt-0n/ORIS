/**
 * Jest test setup — creates an isolated temp SQLite database for each test run.
 * Sets DB_PATH, JWT_SECRET env vars before any module loads.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create a temp database file for this test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oris-test-'));
const testDbPath = path.join(tmpDir, 'test.sqlite');

// Set env vars BEFORE any module is loaded
process.env.DB_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '0';

// Store tmpDir for cleanup in teardown
global.__TEST_TMP_DIR = tmpDir;
