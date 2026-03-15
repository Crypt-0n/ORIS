/**
 * Migration 005 - Performance Optimizations
 * Creates indexes on frequently queried foreign keys and columns
 * to avoid table scans and improve join performance.
 */

exports.up = function(knex) {
  return Promise.all([
    knex.schema.alterTable('comments', table => {
      table.index(['task_id'], 'idx_comments_task_id');
    }),
    knex.schema.alterTable('tasks', table => {
      table.index(['case_id'], 'idx_tasks_case_id');
    }),
    knex.schema.alterTable('case_events', table => {
      table.index(['event_datetime'], 'idx_case_events_event_datetime');
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.alterTable('comments', table => {
      table.dropIndex(['task_id'], 'idx_comments_task_id');
    }),
    knex.schema.alterTable('tasks', table => {
      table.dropIndex(['case_id'], 'idx_tasks_case_id');
    }),
    knex.schema.alterTable('case_events', table => {
      table.dropIndex(['event_datetime'], 'idx_case_events_event_datetime');
    })
  ]);
};
