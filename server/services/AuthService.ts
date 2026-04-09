import crypto from 'crypto';
// @ts-ignore
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import { getRoles, isAdmin } from '../utils/access';
// @ts-ignore
import OTPAuth from 'otpauth';
// @ts-ignore
import QRCode from 'qrcode';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_oris_key';
const SALT_ROUNDS = 10;
const AVATARS_DIR = process.env.DB_PATH
  ? path.join(path.dirname(process.env.DB_PATH), 'avatars')
  : path.join(__dirname, '..', 'avatars');

if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

export class AuthService {
  static async logConnection(userId: string, ip: string, userAgent: string, success = true) {
    try {
      const loginRepo = new BaseRepository(getDb(), 'login_history');
      await loginRepo.create({
        id: crypto.randomUUID(),
        user_id: userId,
        ip_address: ip,
        user_agent: userAgent,
        success: success ? 1 : 0,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error logging connection:', e);
    }
  }

  static async getAllowApiTokensConfig() {
    const configRepo = new BaseRepository(getDb(), 'system_config');
    const rows = await configRepo.findWhere({ key: 'allow_api_tokens' });
    const config = rows.length > 0 ? rows[0] : null;
    return { allowApiTokens: config ? config.value === 'true' : true };
  }

  static async register(data: any, token?: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const db = getDb();
    const countCursor = await db.query(`RETURN LENGTH(user_profiles)`);
    const countResult = await countCursor.next();
    const userCount = Number(countResult);

    if (userCount > 0) {
      if (!token) throw new Error('Authentication required to create users');
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const requester = await userRepo.findById(decoded.id);
        if (!requester) throw new Error('Invalid token');
        if (!isAdmin(requester.role)) throw new Error('Admin access required to create users');
      } catch (err: any) {
        throw new Error(`Invalid or expired token: ${err.message}`);
      }
    }

    const email = data.email.trim().toLowerCase();
    const existing = await userRepo.findWhere({ email });
    if (existing.length > 0) throw new Error('User already exists');

    const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const id = crypto.randomUUID();
    const rolesStr = JSON.stringify(data.roles || ['user']);

    await userRepo.create({
      id,
      email,
      full_name: data.fullName || data.full_name,
      role: rolesStr,
      password_hash,
      is_active: 1,
      created_at: new Date().toISOString(),
    });

    const sessionToken = jwt.sign({ id, email, role: JSON.parse(rolesStr) }, JWT_SECRET, { expiresIn: '8h' });
    return {
      user: { id, email, user_metadata: { full_name: data.fullName || data.full_name, role: JSON.parse(rolesStr) } },
      session: { access_token: sessionToken },
    };
  }

  static async login(data: any) {
    const email = data.email.trim().toLowerCase();
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const users = await userRepo.findWhere({ email });
    const user = users.length > 0 ? users[0] : null;

    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    const match = await bcrypt.compare(data.password, user.password_hash);
    if (!match) {
      console.error(`LOGIN FAIL: authentication failed for [${email}]`);
      throw new Error('Invalid credentials');
    }
    if (!user.is_active) throw new Error('Account disabled');

    if (user.totp_enabled) {
      const tempToken = jwt.sign({ id: user.id, purpose: '2fa' }, JWT_SECRET, { expiresIn: '5m' });
      return { requires_2fa: true, temp_token: tempToken };
    }

    const sessionToken = jwt.sign({ id: user.id, email: user.email, role: getRoles(user.role) }, JWT_SECRET, {
      expiresIn: '8h',
    });

    return {
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name, role: getRoles(user.role) } },
      session: { access_token: sessionToken },
    };
  }

  static async getMe(userId: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const has_pin = !!user.pin_hash;
    delete user.pin_hash;
    user.role = getRoles(user.role);

    const globalRoles = user.role;
    const isAdminUser = globalRoles.includes('admin');
    const isTeamLead = globalRoles.includes('team_leader');

    let canSeeCases = isAdminUser || isTeamLead;
    let canSeeAlerts = isAdminUser || isTeamLead;

    if (!canSeeCases || !canSeeAlerts) {
      const memberRepo = new BaseRepository(getDb(), 'beneficiary_members');
      const memberships = await memberRepo.findWhere({ user_id: userId });
      for (const m of memberships) {
        try {
          const roles = typeof m.role === 'string' ? JSON.parse(m.role) : (m.role || []);
          if (!canSeeCases && roles.some((r: string) => r.startsWith('case_'))) canSeeCases = true;
          if (!canSeeAlerts && roles.some((r: string) => r.startsWith('alert_'))) canSeeAlerts = true;
        } catch (e) {}
        if (canSeeCases && canSeeAlerts) break;
      }
    }

    return { user: { ...user, has_pin, canSeeCases, canSeeAlerts } };
  }

  static async updatePassword(userId: string, data: any) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.password_hash) throw new Error('Invalid credentials');

    const match = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!match) throw new Error('Le mot de passe actuel est incorrect');

    const new_password_hash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
    await userRepo.update(userId, { password_hash: new_password_hash });
  }

  static async updatePreferences(userId: string, preferences: any) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user) throw new Error('User not found');
    
    // Merge existing preferences with new ones
    const existingPrefs = user.preferences || {};
    const newPrefs = { ...existingPrefs, ...preferences };
    
    await userRepo.update(userId, { preferences: newPrefs });
    return newPrefs;
  }

  static async getUsers() {
    const db = getDb();
    const query = `
      FOR u IN user_profiles
      FILTER u.is_active == 1
      SORT u.full_name ASC
      RETURN { id: u._key, email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active }
    `;
    const cursor = await db.query(query);
    const users = await cursor.all();
    return users.map((u: any) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      full_name: u.full_name,
      role: getRoles(u.role),
      is_active: u.is_active,
    }));
  }

  static async getUsersList() {
    const db = getDb();
    const cursor = await db.query(
      `FOR u IN user_profiles FILTER u.is_active == 1 SORT u.full_name ASC RETURN { id: u._key, full_name: u.full_name }`
    );
    return await cursor.all();
  }

  static async updateAvatar(userId: string, file: any) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) throw new Error('Only JPEG, PNG, and WebP images are allowed');
    if (file.size > 2 * 1024 * 1024) throw new Error('File size must be under 2 MB');

    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const existing = await userRepo.findById(userId);
    if (existing && existing.avatar_url) {
      const oldPath = path.join(AVATARS_DIR, path.basename(existing.avatar_url.split('?')[0]));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const ext = path.extname(file.name) || '.jpg';
    const fileName = `${userId}${ext}`;
    const filePath = path.join(AVATARS_DIR, fileName);
    await file.mv(filePath);

    const avatarUrl = `/api/auth/avatar/${userId}?v=${Date.now()}`;
    await userRepo.update(userId, { avatar_url: avatarUrl });
    return avatarUrl;
  }

  static async deleteAvatar(userId: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (user && user.avatar_url) {
      const files = fs.readdirSync(AVATARS_DIR).filter((f: string) => f.startsWith(userId));
      files.forEach((f: string) => {
        const fp = path.join(AVATARS_DIR, f);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
    }
    await userRepo.update(userId, { avatar_url: null });
  }

  static getAvatarPath(userId: string) {
    const files = fs.readdirSync(AVATARS_DIR).filter((f: string) => f.startsWith(userId));
    if (files.length === 0) return null;
    return path.join(AVATARS_DIR, files[0]);
  }

  static async updatePin(userId: string, data: any) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.password_hash) throw new Error('Invalid credentials');

    const match = await bcrypt.compare(data.currentPassword, user.password_hash);
    if (!match) throw new Error('Invalid password');

    if (data.remove) {
      await userRepo.update(userId, { pin_hash: null });
      return { success: true, has_pin: false };
    }

    if (!data.pin || !/^\\d{4,6}$/.test(data.pin)) throw new Error('PIN must be 4-6 digits');
    const pin_hash = await bcrypt.hash(data.pin, SALT_ROUNDS);
    await userRepo.update(userId, { pin_hash });
    return { success: true, has_pin: true };
  }

  static async verifyPin(userId: string, pin: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.pin_hash) throw new Error('No PIN set');

    const match = await bcrypt.compare(pin, user.pin_hash);
    if (!match) throw new Error('Invalid PIN');
  }

  static async verifyPassword(userId: string, password: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.password_hash) throw new Error('Invalid credentials');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new Error('Invalid password');
  }

  static async getApiTokens(userId: string) {
    const tokenRepo = new BaseRepository(getDb(), 'api_tokens');
    const tokens = await tokenRepo.findWhere({ user_id: userId }, { sort: '-created_at' });
    return tokens.map((t: any) => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at,
      last_used_at: t.last_used_at,
    }));
  }

  static async createApiToken(userId: string, name: string) {
    const configRepo = new BaseRepository(getDb(), 'system_config');
    const rows = await configRepo.findWhere({ key: 'allow_api_tokens' });
    const config = rows.length > 0 ? rows[0] : null;
    if (config && config.value === 'false') throw new Error('API tokens are globally disabled');

    const rawToken = 'oris_tk_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const id = crypto.randomUUID();

    const tokenRepo = new BaseRepository(getDb(), 'api_tokens');
    await tokenRepo.create({
      id,
      user_id: userId,
      name,
      token_hash: tokenHash,
      created_at: new Date().toISOString(),
    });

    return { id, name, token: rawToken };
  }

  static async deleteApiToken(userId: string, tokenId: string) {
    const db = getDb();
    await db.query(
      `FOR t IN api_tokens FILTER t._key == @id AND t.user_id == @userId REMOVE t IN api_tokens`,
      { id: tokenId, userId }
    );
  }

  static async refreshToken(userId: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.is_active) throw new Error('User not found or disabled');
    const token = jwt.sign({ id: user.id, email: user.email, role: getRoles(user.role) }, JWT_SECRET, {
      expiresIn: '8h',
    });
    return token;
  }

  static async getLoginHistory(userId: string, limit: number) {
    const db = getDb();
    const cursor = await db.query(
      `FOR l IN login_history FILTER l.user_id == @userId SORT l.created_at DESC LIMIT @limit RETURN { id: l._key, ip_address: l.ip_address, user_agent: l.user_agent, success: l.success, created_at: l.created_at }`,
      { userId, limit }
    );
    return await cursor.all();
  }

  static async getAllLoginHistory(userId: string, limit: number) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const currentUser = await userRepo.findById(userId);
    if (!currentUser || !isAdmin(currentUser.role)) throw new Error('Admin only');

    const db = getDb();
    const aql = `
      FOR lh IN login_history
          SORT lh.created_at DESC
          LIMIT ${limit}
          LET u = DOCUMENT('user_profiles', lh.user_id)
          RETURN {
              id: lh._key, user_id: lh.user_id, ip_address: lh.ip_address, 
              user_agent: lh.user_agent, success: lh.success, created_at: lh.created_at,
              full_name: u.full_name, email: u.email
          }
    `;
    const cursor = await db.query(aql);
    return await cursor.all();
  }

  // =============== TOTP 2FA ===============

  static async verify2fa(data: any) {
    let decoded: any;
    try {
      decoded = jwt.verify(data.temp_token, JWT_SECRET);
    } catch {
      throw new Error('Token expiré ou invalide. Veuillez vous reconnecter.');
    }
    if (decoded.purpose !== '2fa') throw new Error('Token invalide');

    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(decoded.id);
    if (!user || !user.totp_secret || !user.totp_enabled) throw new Error('2FA non configuré');

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    const delta = totp.validate({ token: data.code.replace(/\\s/g, ''), window: 1 });
    if (delta === null) throw new Error('Code invalide');

    const sessionToken = jwt.sign(
      { id: user.id, email: user.email, role: getRoles(user.role) },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      userId: user.id,
      user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name, role: getRoles(user.role) } },
      session: { access_token: sessionToken },
    };
  }

  static async setup2fa(userId: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.totp_enabled) throw new Error('2FA déjà activé');

    const secret = new OTPAuth.Secret();
    const totp = new OTPAuth.TOTP({
      issuer: 'ORIS',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    await userRepo.update(userId, { totp_secret: secret.base32 });

    const uri = totp.toString();
    const qrCode = await QRCode.toDataURL(uri);
    return { secret: secret.base32, qrCode, uri };
  }

  static async enable2fa(userId: string, code: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.totp_secret) throw new Error("2FA non configuré. Appelez /2fa/setup d'abord.");
    if (user.totp_enabled) throw new Error('2FA déjà activé');

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    const delta = totp.validate({ token: code.replace(/\\s/g, ''), window: 1 });
    if (delta === null) throw new Error('Code invalide. Vérifiez votre application.');

    await userRepo.update(userId, { totp_enabled: 1 });
  }

  static async disable2fa(userId: string, code: string) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user || !user.totp_enabled) throw new Error('2FA non activé');

    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(user.totp_secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    const delta = totp.validate({ token: code.replace(/\\s/g, ''), window: 1 });
    if (delta === null) throw new Error('Code invalide');

    await userRepo.update(userId, { totp_enabled: 0, totp_secret: null });
  }
}
