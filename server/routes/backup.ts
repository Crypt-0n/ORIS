import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import { requireAdmin, isAdmin } from '../utils/access';
import * as backup from '../utils/backup';
import authenticateToken from '../middleware/auth';

const router = express.Router();

// Schema for config
const configSchema = z.object({
  interval: z.number().int().min(1).max(24).optional(),
  retention: z.number().int().min(1).max(100).optional(),
});

// Type extension for req.files from express-fileupload
interface FileRequest extends Request {
  files?: {
    backup?: {
      name: string;
      mv: (path: string) => Promise<void>;
    };
    [key: string]: any;
  };
}

// ── Public endpoints (no auth required) ─────────────────────────────
// These are only accessible when NO admin exists (fresh install)
router.get('/can-restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = new BaseRepository(getDb(), 'user_profiles');
    const users = await repo.findWhere({});
    const hasAdmin = users.some((u: any) => isAdmin(u.role));
    res.json({ canRestore: !hasAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/restore', async (req: FileRequest, res: Response): Promise<void> => {
  try {
    const repo = new BaseRepository(getDb(), 'user_profiles');
    const users = await repo.findWhere({});
    const hasAdmin = users.some((u: any) => isAdmin(u.role));
    
    if (hasAdmin) {
      res.status(403).json({ error: 'Restore is only available on a fresh server with no admin user' });
      return;
    }

    if (!req.files || !req.files.backup) {
      res.status(400).json({ error: 'No backup file uploaded. Use field name "backup".' });
      return;
    }
    
    const file = req.files.backup;
    if (!file.name.endsWith('.zip')) {
      res.status(400).json({ error: 'Backup file must be a .zip archive' });
      return;
    }

    const tmpPath = path.join(backup.BACKUP_DIR, '_restore_tmp.zip');
    if (!fs.existsSync(backup.BACKUP_DIR)) fs.mkdirSync(backup.BACKUP_DIR, { recursive: true });
    
    await file.mv(tmpPath);
    await backup.restoreFromBackup(tmpPath);
    
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err: any) {
    console.error('[Restore] Error:', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

// ── Authenticated admin endpoints ───────────────────────────────────
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const backups = backup.listBackups();
    const interval = await backup.getBackupInterval();
    const retention = await backup.getRetentionCount();
    res.json({ backups, config: { interval, retention } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = await backup.createBackup();
    res.json({ success: true, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

router.post('/full', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const name = await backup.createFullBackup();
    if (!name) {
      res.status(500).json({ error: 'Full backup failed' });
      return;
    }
    res.json({ success: true, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Full backup failed' });
  }
});

router.post('/restore-admin', async (req: FileRequest, res: Response): Promise<void> => {
  try {
    if (!req.files || !req.files.backup) {
      res.status(400).json({ error: 'No backup file uploaded. Use field name "backup".' });
      return;
    }
    const file = req.files.backup;
    if (!file.name.endsWith('.zip')) {
      res.status(400).json({ error: 'Backup file must be a .zip archive' });
      return;
    }

    const tmpPath = path.join(backup.BACKUP_DIR, '_restore_tmp.zip');
    if (!fs.existsSync(backup.BACKUP_DIR)) fs.mkdirSync(backup.BACKUP_DIR, { recursive: true });
    await file.mv(tmpPath);

    await backup.restoreFromBackup(tmpPath);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err: any) {
    console.error('[Restore-Admin] Error:', err);
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

router.get('/download/:name', (req: AuthenticatedRequest, res: Response): void => {
  const p = backup.getBackupPath((req.params.name as string));
  if (!p) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  res.download(p as string, (req.params.name as string));
});

router.delete('/:name', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const ok = backup.deleteBackup((req.params.name as string));
    if (!ok) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.put('/config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = configSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid configuration payload', details: (validation.error as any).errors });
      return;
    }
    
    const { interval, retention } = validation.data;
    const db = getDb();
    
    if (interval !== undefined) {
      await db.query(
        `UPSERT { key: 'backup_interval_hours' } INSERT { key: 'backup_interval_hours', value: @val } UPDATE { value: @val } IN system_config`,
        { val: String(interval) }
      );
    }
    if (retention !== undefined) {
      await db.query(
        `UPSERT { key: 'backup_retention_count' } INSERT { key: 'backup_retention_count', value: @val } UPDATE { value: @val } IN system_config`,
        { val: String(retention) }
      );
    }
    backup.startScheduler();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Config update failed' });
  }
});

module.exports = router;
