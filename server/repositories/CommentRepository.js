const { getDb } = require('../db-arango');
const BaseRepository = require('./BaseRepository');

class CommentRepository extends BaseRepository {
    constructor() {
        super(getDb(), 'comments');
    }

    async findByTaskId(taskId) {
        const aql = `
            FOR c IN comments
                FILTER c.task_id == @taskId
                SORT c.created_at ASC
                LET author = DOCUMENT('user_profiles', c.author_id)
                LET attachments = (
                    FOR a IN comment_attachments
                        FILTER a.comment_id == c._key
                        RETURN {
                            id: a._key,
                            comment_id: a.comment_id,
                            file_name: a.file_name,
                            file_size: a.file_size,
                            content_type: a.content_type,
                            storage_path: a.storage_path
                        }
                )
                RETURN MERGE(c, {
                    id: c._key,
                    parent_id: c.parent_id || null,
                    author: { full_name: author.full_name },
                    attachments: attachments
                })
        `;
        return this.query(aql, { taskId });
    }
}

module.exports = CommentRepository;
