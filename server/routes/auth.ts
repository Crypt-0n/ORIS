import { AuthenticatedRequest } from '../types';
import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService';
import authenticateToken from '../middleware/auth';
// @ts-ignore
import rateLimit from '../middleware/rateLimit';

const isTest = process.env.NODE_ENV === 'test';
const bypassLimiter = (req: AuthenticatedRequest, res: Response, next: NextFunction) => next();

const loginLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
const registerLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'Trop de créations de comptes. Réessayez dans 1 heure.' });
const totpLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de tentatives 2FA. Réessayez dans 15 minutes.' });
const verifyLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de tentatives de vérification. Réessayez dans 15 minutes.' });

const router = express.Router();


// ── Rate limited Public/Unauthenticated Endpoints ───────────────────────────

router.get('/config/allow-api-tokens', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await AuthService.getAllowApiTokensConfig();
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const passwordSchema = z.string()
  .min(12, 'Mot de passe trop court (12 caractères minimum)')
  .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
  .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Doit contenir au moins un caractère spécial');

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  full_name: z.string().optional(),
  fullName: z.string().optional(),
  roles: z.array(z.string()).optional(),
}).refine(data => data.full_name || data.fullName, {
  message: "Either full_name or fullName is required",
});

router.post('/register', registerLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Missing required fields or invalid format', details: validation.error.format() });
      return;
    }
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    const result = await AuthService.register(validation.data, token);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await AuthService.logConnection(result.user.id, ip, ua, true);
    
    if (result.session && result.session.access_token) {
      res.cookie('oris_jwt', result.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });
    }
    
    res.json(result);
  } catch (err: any) {
    if (err.message.includes('Authentication required') || err.message.includes('Invalid token') || err.message.includes('Admin access required')) {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err.message === 'User already exists') {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Missing email or password' });
      return;
    }
    
    const result = await AuthService.login(validation.data);
    if (!result.requires_2fa && result.user) {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      const ua = req.headers['user-agent'] || 'unknown';
      await AuthService.logConnection(result.user.id, ip, ua, true);
    }
    if (result.session && result.session.access_token) {
      res.cookie('oris_jwt', result.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });
    }
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Invalid credentials' || err.message === 'Account disabled') {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const verify2faSchema = z.object({
  temp_token: z.string().min(1),
  code: z.string().min(1),
});

router.post('/verify-2fa', totpLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = verify2faSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Missing temp_token or code' });
      return;
    }
    const result = await AuthService.verify2fa(validation.data);
    
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await AuthService.logConnection(result.userId, ip, ua, true);
    
    if (result.session && result.session.access_token) {
      res.cookie('oris_jwt', result.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000
      });
    }
    
    res.json({ user: result.user, session: result.session });
  } catch (err: any) {
    if (err.message.includes('Token') || err.message.includes('Code invalide')) {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err.message === '2FA non configuré') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── API Authenticated endpoints ─────────────────────────────────────────────

router.get('/avatar/:userId', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const filePath = AuthService.getAvatarPath((req.params.userId as string));
    if (!filePath) {
      res.status(404).json({ error: 'Avatar not found' });
      return;
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.use(authenticateToken); // Applying JWT check here for all below

router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await AuthService.getMe(req.user.id);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'User not found') {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

router.put('/password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = updatePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Missing required fields or too short' });
      return;
    }
    await AuthService.updatePassword(req.user.id, validation.data);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Invalid credentials' || err.message === 'Le mot de passe actuel est incorrect') {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await AuthService.getUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/avatar', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.files || !req.files.avatar) {
      res.status(400).json({ error: 'No avatar file uploaded' });
      return;
    }
    const avatarUrl = await AuthService.updateAvatar(req.user.id, req.files.avatar);
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (err: any) {
    if (err.message.includes('JPEG') || err.message.includes('File size')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/avatar', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await AuthService.deleteAvatar(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const pinSchema = z.object({
  currentPassword: z.string().min(1),
  pin: z.string().optional(),
  remove: z.boolean().optional(),
});

router.put('/pin', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = pinSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Current password is required' });
      return;
    }
    const result = await AuthService.updatePin(req.user.id, validation.data);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Invalid credentials' || err.message === 'Invalid password') {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err.message.includes('PIN must be')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const verifyPinSchema = z.object({
  pin: z.string().min(1),
});

router.post('/verify-pin', verifyLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = verifyPinSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'PIN is required' });
      return;
    }
    await AuthService.verifyPin(req.user.id, validation.data.pin);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Invalid PIN') {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err.message === 'No PIN set') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const verifyPwdSchema = z.object({
  password: z.string().min(1),
});

router.post('/verify-password', verifyLimiter, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = verifyPwdSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }
    await AuthService.verifyPassword(req.user.id, validation.data.password);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Invalid credentials' || err.message === 'Invalid password') {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users-list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await AuthService.getUsersList();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api-tokens', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tokens = await AuthService.getApiTokens(req.user.id);
    res.json(tokens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const apiTokenNameSchema = z.object({
  name: z.string().min(1),
});

router.post('/api-tokens', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = apiTokenNameSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const result = await AuthService.createApiToken(req.user.id, validation.data.name);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'API tokens are globally disabled') {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/api-tokens/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await AuthService.deleteApiToken(req.user.id, (req.params.id as string));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const token = await AuthService.refreshToken(req.user.id);
    res.cookie('oris_jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });
    res.json({ session: { access_token: token } });
  } catch (err: any) {
    if (err.message === 'User not found or disabled') {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req: AuthenticatedRequest, res: Response): void => {
  res.clearCookie('oris_jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true });
});

router.get('/login-history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = await AuthService.getLoginHistory(req.user.id, limit);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/login-history/all', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const history = await AuthService.getAllLoginHistory(req.user.id, limit);
    res.json(history);
  } catch (err: any) {
    if (err.message === 'Admin only') {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/setup', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await AuthService.setup2fa(req.user.id);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'User not found') {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === '2FA déjà activé') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const codeSchema = z.object({
  code: z.string().min(1),
});

router.post('/2fa/enable', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = codeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Code requis' });
      return;
    }
    await AuthService.enable2fa(req.user.id, validation.data.code);
    res.json({ success: true, message: '2FA activé avec succès' });
  } catch (err: any) {
    if (err.message.includes('non configuré') || err.message.includes('déjà activé')) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err.message.includes('Code invalide')) {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/disable', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = codeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Code requis' });
      return;
    }
    await AuthService.disable2fa(req.user.id, validation.data.code);
    res.json({ success: true, message: '2FA désactivé' });
  } catch (err: any) {
    if (err.message === '2FA non activé') {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err.message === 'Code invalide') {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
