import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { AdminService } from '../services/AdminService';
import authenticateToken from '../middleware/auth';
import { requireAdmin, getRoles } from '../utils/access';

const router = express.Router();

// ── Public Endpoint ─────────────────────────────────────────────────────────
router.get('/setup-status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await AdminService.getSetupStatus();
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.use(authenticateToken);
router.use(requireAdmin);

// ── User Management ─────────────────────────────────────────────────────────

router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await AdminService.getUsers();
    res.json(users.map((u: any) => ({ ...u, roles: getRoles(u.role) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  roles: z.array(z.string()).optional(),
  beneficiaryIds: z.array(z.string()).optional(),
});

router.post('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    const id = await AdminService.createUser(validation.data);
    res.status(201).json({ success: true, id });
  } catch (err: any) {
    if (err.message === 'Email already exists') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().min(1).optional(),
  roles: z.array(z.string()).optional(),
  password: z.string().min(6).optional(),
  is_active: z.boolean().optional(),
  beneficiaryIds: z.array(z.string()).optional(),
});

router.put('/users/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    await AdminService.updateUser((req.params.id as string), req.user.id, validation.data);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message.includes('Cannot remove your own admin role') || err.message.includes('Email already exists') || err.message.includes('Cannot deactivate your own account')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await AdminService.deleteUser((req.params.id as string), req.user.id);
    res.json({ success: true, deactivated: true });
  } catch (err: any) {
    if (err.message === 'Cannot deactivate yourself') {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err.message === 'User not found') {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── System Config ───────────────────────────────────────────────────────────

router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await AdminService.getConfig();
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

router.put('/config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = updateConfigSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    const { key, value } = validation.data;
    await AdminService.updateConfig(key, String(value));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Beneficiaries ─────────────────────────────────────────────────────────

router.get('/beneficiaries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const beneficiaries = await AdminService.getBeneficiaries();
    res.json(beneficiaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/beneficiaries/:id/members', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const members = await AdminService.getBeneficiaryMembers((req.params.id as string));
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const setTeamLeadSchema = z.object({
  is_team_lead: z.boolean(),
});

router.put('/beneficiaries/members/:id/team-lead', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = setTeamLeadSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    await AdminService.updateBeneficiaryMemberTeamLead((req.params.id as string), validation.data.is_team_lead);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const setRoleSchema = z.object({
  roles: z.array(z.string()),
});

router.put('/beneficiaries/members/:id/role', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = setRoleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    await AdminService.updateBeneficiaryMemberRole((req.params.id as string), validation.data.roles);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const createBeneficiarySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post('/beneficiaries', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = createBeneficiarySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    const id = await AdminService.createBeneficiary(validation.data.name, validation.data.description);
    res.status(201).json({ success: true, id });
  } catch (err: any) {
    if (err.message === 'Beneficiary name already exists') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateBeneficiarySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.put('/beneficiaries/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = updateBeneficiarySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    await AdminService.updateBeneficiary((req.params.id as string), validation.data.name, validation.data.description);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Beneficiary name already exists') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/beneficiaries/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await AdminService.deleteBeneficiary((req.params.id as string));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const addMemberSchema = z.object({
  user_id: z.string().min(1),
});

router.post('/beneficiaries/:id/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = addMemberSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
      return;
    }
    const id = await AdminService.addBeneficiaryMember((req.params.id as string), validation.data.user_id);
    res.status(201).json({ success: true, id });
  } catch (err: any) {
    if (err.message === 'User is already a member of this beneficiary') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/beneficiaries/members/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await AdminService.removeBeneficiaryMember((req.params.id as string));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
