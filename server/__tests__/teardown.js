/**
 * Global teardown — cleanup temp test database.
 */
const fs = require('fs');

module.exports = async function () {
    // Cleanup is best-effort
    if (global.__TEST_TMP_DIR) {
        try {
            fs.rmSync(global.__TEST_TMP_DIR, { recursive: true, force: true });
        } catch (e) {}
    }
};
