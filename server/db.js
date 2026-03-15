/**
 * Database connection — ORIS.
 * 
 * Returns a Knex.js instance configured from knexfile.js.
 * This replaces the previous better-sqlite3 direct access.
 * 
 * Usage (async):
 *   const db = require('./db');
 *   const row = await db('users').where({ id }).first();
 *   await db('users').insert({ id, name });
 */
const knex = require('knex');
const config = require('./knexfile');

const db = knex(config);

module.exports = db;
