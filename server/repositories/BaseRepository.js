/**
 * BaseRepository — Generic CRUD operations using ArangoDB AQL.
 *
 * Provides reusable methods for all document collections.
 * All routes should use repositories instead of direct knex/db calls.
 *
 * Usage:
 *   const repo = new BaseRepository(db, 'cases');
 *   const doc = await repo.findById('some-id');
 *   const docs = await repo.findByField('status', 'open');
 *   const id = await repo.create({ title: 'New Case' });
 *   await repo.update('some-id', { status: 'closed' });
 *   await repo.delete('some-id');
 */
const crypto = require('crypto');

class BaseRepository {
    /**
     * @param {import('arangojs').Database} db - ArangoDB database instance
     * @param {string} collectionName - Name of the ArangoDB collection
     */
    constructor(db, collectionName) {
        this.db = db;
        this.collectionName = collectionName;
        this.collection = db.collection(collectionName);
    }

    /**
     * Normalize an ArangoDB document to look like a regular object.
     * Replaces _key with id and strips ArangoDB internal fields.
     */
    _normalize(doc) {
        if (!doc) return null;
        const { _id, _rev, _key, ...rest } = doc;
        return { id: _key, ...rest };
    }

    /**
     * Normalize an array of documents.
     */
    _normalizeAll(docs) {
        return docs.map(d => this._normalize(d));
    }

    // ─── Read Operations ─────────────────────────────────────

    /**
     * Find a document by its ID (_key).
     */
    async findById(id) {
        try {
            const doc = await this.collection.document(id);
            return this._normalize(doc);
        } catch (err) {
            if (err.code === 404 || err.errorNum === 1202) return null;
            throw err;
        }
    }

    /**
     * Find documents matching a single field value.
     */
    async findByField(field, value, options = {}) {
        const { sort, limit, offset } = options;
        let aql = `FOR d IN ${this.collectionName} FILTER d.@field == @value`;
        if (sort) {
            const dir = sort.startsWith('-') ? 'DESC' : 'ASC';
            const sortField = sort.replace(/^-/, '');
            aql += ` SORT d.${sortField} ${dir}`;
        }
        if (limit) aql += ` LIMIT ${offset || 0}, ${limit}`;
        aql += ` RETURN d`;

        const cursor = await this.db.query(aql, { field, value });
        return this._normalizeAll(await cursor.all());
    }

    /**
     * Find documents matching multiple filter criteria.
     */
    async findWhere(filters = {}, options = {}) {
        const { sort, limit, offset } = options;
        const bindVars = {};
        const conditions = [];

        Object.entries(filters).forEach(([key, value], i) => {
            if (value === null) {
                conditions.push(`d.${key} == null`);
            } else if (value === undefined) {
                // Skip undefined values
            } else {
                bindVars[`val${i}`] = value;
                conditions.push(`d.${key} == @val${i}`);
            }
        });

        let aql = `FOR d IN ${this.collectionName}`;
        if (conditions.length > 0) {
            aql += ` FILTER ${conditions.join(' AND ')}`;
        }
        if (sort) {
            const dir = sort.startsWith('-') ? 'DESC' : 'ASC';
            const sortField = sort.replace(/^-/, '');
            aql += ` SORT d.${sortField} ${dir}`;
        }
        if (limit) aql += ` LIMIT ${offset || 0}, ${limit}`;
        aql += ` RETURN d`;

        const cursor = await this.db.query(aql, bindVars);
        return this._normalizeAll(await cursor.all());
    }

    /**
     * Count documents matching filters.
     */
    async count(filters = {}) {
        const bindVars = {};
        const conditions = [];

        Object.entries(filters).forEach(([key, value], i) => {
            if (value !== undefined) {
                bindVars[`val${i}`] = value;
                conditions.push(`d.${key} == @val${i}`);
            }
        });

        let aql = `FOR d IN ${this.collectionName}`;
        if (conditions.length > 0) {
            aql += ` FILTER ${conditions.join(' AND ')}`;
        }
        aql += ` COLLECT WITH COUNT INTO c RETURN c`;

        const cursor = await this.db.query(aql, bindVars);
        const result = await cursor.all();
        return result[0] || 0;
    }

    /**
     * Find the first document matching filters.
     */
    async findFirst(filters = {}, options = {}) {
        const results = await this.findWhere(filters, { ...options, limit: 1 });
        return results[0] || null;
    }

    // ─── Write Operations ────────────────────────────────────

    /**
     * Create a new document. Returns the generated ID.
     */
    async create(data) {
        const id = data.id || crypto.randomUUID();
        const now = new Date().toISOString();

        const doc = {
            _key: id,
            ...data,
            created_at: data.created_at || now,
            updated_at: data.updated_at || now,
        };
        delete doc.id; // Don't store id as both _key and field

        await this.collection.save(doc);
        return id;
    }

    /**
     * Update a document by ID.
     */
    async update(id, data) {
        const updateData = {
            ...data,
            updated_at: data.updated_at || new Date().toISOString(),
        };
        delete updateData.id;
        delete updateData._key;

        try {
            await this.collection.update(id, updateData);
            return true;
        } catch (err) {
            if (err.code === 404 || err.errorNum === 1202) return false;
            throw err;
        }
    }

    /**
     * Delete a document by ID.
     */
    async delete(id) {
        try {
            await this.collection.remove(id);
            return true;
        } catch (err) {
            if (err.code === 404 || err.errorNum === 1202) return false;
            throw err;
        }
    }

    /**
     * Delete documents matching filters.
     */
    async deleteWhere(filters = {}) {
        const bindVars = {};
        const conditions = [];

        Object.entries(filters).forEach(([key, value], i) => {
            bindVars[`val${i}`] = value;
            conditions.push(`d.${key} == @val${i}`);
        });

        if (conditions.length === 0) return 0;

        const aql = `FOR d IN ${this.collectionName} FILTER ${conditions.join(' AND ')} REMOVE d IN ${this.collectionName} RETURN OLD`;
        const cursor = await this.db.query(aql, bindVars);
        const removed = await cursor.all();
        return removed.length;
    }

    // ─── Raw AQL ─────────────────────────────────────────────

    /**
     * Execute a raw AQL query and return normalized results.
     */
    async query(aql, bindVars = {}) {
        const cursor = await this.db.query(aql, bindVars);
        const results = await cursor.all();
        return results.map(r => {
            if (r && r._key) return this._normalize(r);
            return r;
        });
    }
}

module.exports = BaseRepository;
