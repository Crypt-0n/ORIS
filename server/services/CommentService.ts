import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
// @ts-ignore
import CommentRepository from '../repositories/CommentRepository';
import { canAccessCase, isAdmin, isTeamLeadForBeneficiary } from '../utils/access';
import { logAudit } from '../utils/audit';
import { NotificationService } from './NotificationService';

const UPLOADS_DIR = process.env.DB_PATH
  ? path.join(path.dirname(process.env.DB_PATH), 'uploads')
  : path.join(__dirname, '..', 'uploads');

export class CommentService {
  static async getCommentsByTaskId(taskId: string, userId: string) {
    const taskRepo = new BaseRepository(getDb(), 'tasks');
    const taskInfo = await taskRepo.findById(taskId);
    if (taskInfo && !(await canAccessCase(userId, taskInfo.case_id))) {
      throw new Error('Access denied');
    }

    const commentRepo = new CommentRepository();
    return await commentRepo.findByTaskId(taskId);
  }

  static async createComment(data: any, files: any, userId: string) {
    const { task_id, content, parent_id } = data;
    const taskRepo = new BaseRepository(getDb(), 'tasks');
    const taskInfo = await taskRepo.findById(task_id);
    if (taskInfo && !(await canAccessCase(userId, taskInfo.case_id))) {
      throw new Error('Access denied');
    }

    const id = crypto.randomUUID();
    const commentRepo = new CommentRepository();
    await commentRepo.create({ id, task_id, author_id: userId, content, parent_id: parent_id || null });

    const task = taskInfo;
    if (task) {
      logAudit(task.case_id, userId, 'comment_added', 'task', task_id, { task_title: task.title, comment_id: id });
    }

    // Parse @mentions and create notifications
    try {
      const userRepo = new BaseRepository(getDb(), 'user_profiles');
      const author = await userRepo.findById(userId);
      const authorName = author?.full_name || "Quelqu'un";

      const mentionHtmlRegex = /data-type="mention"\s+data-id="([^"]+)"/g;
      let htmlMatch;
      const mentionedIds = new Set<string>();
      while ((htmlMatch = mentionHtmlRegex.exec(content)) !== null) {
        mentionedIds.add(htmlMatch[1]);
      }

      const plainContent = content.replace(/<[^>]+>/g, '');
      const legacyMentionRegex = /@([A-ZÀ-Üa-zà-ü-]+(?:\s+[A-ZÀ-Üa-zà-ü-]+)+)/g;
      let match;
      const mentionedNames = new Set<string>();
      while ((match = legacyMentionRegex.exec(plainContent)) !== null) {
        mentionedNames.add(match[1].trim());
      }

      const mentionedUsers = [];
      
      for (const id of Array.from(mentionedIds)) {
        if (id !== '__case__') {
          const u = await userRepo.findById(id);
          if (u) mentionedUsers.push(u);
        }
      }

      for (const name of Array.from(mentionedNames)) {
        const u = await userRepo.findFirst({ full_name: name });
        if (u && !mentionedUsers.some((existing) => existing.id === u.id)) {
          mentionedUsers.push(u);
        }
      }

      if (mentionedUsers.length > 0) {

        for (const mentionedUser of mentionedUsers) {
          if (mentionedUser.id !== userId) {
            const link = task ? `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}` : null;
            NotificationService.createNotification(
              mentionedUser.id,
              'mention',
              `${authorName} vous a mentionné`,
              task ? `Dans la tâche "${task.title}"` : 'Dans un commentaire',
              link || undefined
            );
          }
        }
      }

      if ((mentionedIds.has('__case__') || /@case\b/i.test(plainContent)) && task) {
        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseData = await caseRepo.findById(task.case_id);
        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        const assigned = await assignRepo.findWhere({ case_id: task.case_id });
        const notifiedIds = new Set(assigned.map((a: any) => a.user_id));
        if (caseData?.author_id) notifiedIds.add(caseData.author_id);
        notifiedIds.delete(userId);
        const link = `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}`;
        for (const nid of notifiedIds) {
          NotificationService.createNotification(
            nid as string,
            'mention',
            `${authorName} a notifié le dossier`,
            `Dans la tâche "${task.title}" du dossier "${caseData?.title || ''}"`,
            link
          );
        }
      }
    } catch (mentionErr) {
      console.error('Error processing mentions:', mentionErr);
    }

    try {
      if (task && task.case_id) {
        if (task.assigned_to && task.assigned_to !== userId) {
          const userRepo = new BaseRepository(getDb(), 'user_profiles');
          const author = await userRepo.findById(userId);
          const authorName = author?.full_name || "Quelqu'un";
          NotificationService.createNotification(
            task.assigned_to,
            'task_comment',
            `${authorName} a commenté votre tâche`,
            `Tâche : "${task.title}"`,
            `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}`
          );
        }
      }
    } catch (notifErr) {
      console.error('Comment notification error:', notifErr);
    }

    const attachments = [];
    if (files) {
      const filesArray = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
      const uploadDir = path.join(UPLOADS_DIR, 'comments', id);
      if (filesArray.length > 0 && !fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      for (const file of filesArray) {
        const attachId = crypto.randomUUID();
        const ext = path.extname(file.name);
        const storedName = attachId + ext;
        const storagePath = `comments/${id}/${storedName}`;
        const dest = path.join(uploadDir, storedName);
        await file.mv(dest);
        const attRepo = new BaseRepository(getDb(), 'comment_attachments');
        await attRepo.create({
          id: attachId,
          comment_id: id,
          file_name: file.name,
          file_size: file.size,
          content_type: file.mimetype,
          storage_path: storagePath,
        });
        attachments.push({
          id: attachId,
          file_name: file.name,
          file_size: file.size,
          content_type: file.mimetype,
          storage_path: storagePath,
        });
      }
    }

    return { id, attachments };
  }

  static async updateComment(commentId: string, content: string, userId: string) {
    const commentRepo = new CommentRepository();
    const comment = await commentRepo.findById(commentId);
    if (!comment) throw new Error('Comment not found');

    if (comment.author_id !== userId) {
      const userRepo = new BaseRepository(getDb(), 'user_profiles');
      const userRole = await userRepo.findById(userId);
      if (!isAdmin(userRole?.role)) {
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = comment.task_id && (await taskRepo.findById(comment.task_id));
        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseRow = task && (await caseRepo.findById(task.case_id));
        if (!caseRow?.beneficiary_id || !(await isTeamLeadForBeneficiary(userId, caseRow.beneficiary_id))) {
          throw new Error('Unauthorized');
        }
      }
    }

    await commentRepo.update(commentId, { content, is_edited: 1, updated_at: new Date().toISOString() });

    if (comment.task_id) {
      const taskRepo = new BaseRepository(getDb(), 'tasks');
      const task = await taskRepo.findById(comment.task_id);
      if (task) {
        logAudit(task.case_id, userId, 'comment_updated', 'task', comment.task_id, {
          task_title: task.title,
          comment_id: commentId,
        });
      }
    }
  }

  static async deleteComment(commentId: string, userId: string) {
    const commentRepo = new CommentRepository();
    const comment = await commentRepo.findById(commentId);
    if (!comment) throw new Error('Comment not found');

    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const taskRepo = new BaseRepository(getDb(), 'tasks');
    const caseRepo = new BaseRepository(getDb(), 'cases');

    if (comment.author_id !== userId) {
      const userRole = await userRepo.findById(userId);
      if (!isAdmin(userRole?.role)) {
        const task = comment.task_id && (await taskRepo.findById(comment.task_id));
        const caseRow = task && (await caseRepo.findById(task.case_id));
        if (!caseRow?.beneficiary_id || !(await isTeamLeadForBeneficiary(userId, caseRow.beneficiary_id))) {
          throw new Error('Unauthorized');
        }
      }
    }

    if (comment.task_id) {
      const task = await taskRepo.findById(comment.task_id);
      if (task) {
        logAudit(task.case_id, userId, 'comment_removed', 'task', comment.task_id, { task_title: task.title });
      }
    }

    // Soft delete: keep attachments but flag the comment
    await commentRepo.update(commentId, {
      is_deleted: 1,
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    });
  }
}
