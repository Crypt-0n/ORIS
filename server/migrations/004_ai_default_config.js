/**
 * Migration 004 — Pre-configure AI with Ollama
 *
 * Seeds system_config with default Ollama AI configuration
 * so the AI assistant works out of the box with Docker.
 */
exports.up = async function(knex) {
    const defaults = [
        { key: 'ai_enabled', value: 'false' },
        { key: 'ai_provider', value: 'ollama' },
        { key: 'ai_api_url', value: process.env.OLLAMA_URL || 'http://ollama:11434/v1' },
        { key: 'ai_api_key', value: '' },
        { key: 'ai_model', value: 'mistral-nemo' },
        { key: 'ai_temperature', value: '0.3' },
        { key: 'ai_max_tokens', value: '2048' },
        { key: 'ai_system_prompt', value: '' },
    ];

    for (const { key, value } of defaults) {
        const exists = await knex('system_config').where({ key }).first();
        if (!exists) {
            await knex('system_config').insert({ key, value });
        }
    }
};

exports.down = async function(knex) {
    await knex('system_config').whereIn('key', [
        'ai_enabled', 'ai_provider', 'ai_api_url', 'ai_api_key',
        'ai_model', 'ai_temperature', 'ai_max_tokens', 'ai_system_prompt',
    ]).delete();
};
