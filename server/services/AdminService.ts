import crypto from 'crypto';
// @ts-ignore
import bcrypt from 'bcrypt';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import { isAdmin } from '../utils/access';

export class AdminService {
  static async getSetupStatus() {
    const db = getDb();
    const adminCursor = await db.query(`
      FOR u IN user_profiles
      FILTER LIKE(u.role, "%admin%")
      LIMIT 1
      RETURN 1
    `);
    const hasAdminDoc = await adminCursor.next();
    const hasAdmin = !!hasAdminDoc;

    const configRepo = new BaseRepository(db, 'system_config');
    const configRows = await configRepo.findWhere({ key: 'initialization_complete' });
    const config = configRows[0];

    const bCountCursor = await db.query(`RETURN LENGTH(beneficiaries)`);
    const results = await bCountCursor.next();
    const beneficiaryCount = Number(results);

    return {
      hasAdmin,
      isInitialized: config && config.value === 'true' && beneficiaryCount > 0,
    };
  }

  static async getUsers() {
    const db = getDb();
    const cursor = await db.query(`
      FOR u IN user_profiles
      SORT u.created_at DESC
      LET memberships = (FOR b IN beneficiary_members FILTER b.user_id == u._key RETURN b.beneficiary_id)
      RETURN { id: u._key, email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active, created_at: u.created_at, beneficiary_ids: memberships }
    `);
    return await cursor.all();
  }

  static async createUser(data: any) {
    const db = getDb();
    const userRepo = new BaseRepository(db, 'user_profiles');
    const existing = await userRepo.findWhere({ email: data.email });
    if (existing.length > 0) throw new Error('Email already exists');

    const id = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const rolesStr = JSON.stringify(data.roles || ['user']);

    await userRepo.create({
      id,
      email: data.email,
      password_hash: hashedPassword,
      full_name: data.fullName,
      role: rolesStr,
      is_active: 1,
      created_at: new Date().toISOString(),
    });

    if (data.beneficiaryIds && Array.isArray(data.beneficiaryIds) && data.beneficiaryIds.length > 0) {
      const bRepo = new BaseRepository(db, 'beneficiary_members');
      for (const bId of data.beneficiaryIds) {
        await bRepo.create({ id: crypto.randomUUID(), beneficiary_id: bId, user_id: id });
      }
    }

    return id;
  }

  static async updateUser(userId: string, currentUserId: string, data: any) {
    const db = getDb();
    const userRepo = new BaseRepository(db, 'user_profiles');

    if (data.email !== undefined) {
      const existing = await userRepo.findWhere({ email: data.email });
      if (existing.length > 0 && existing[0].id !== userId) throw new Error('Email already exists');
    }

    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.roles !== undefined) {
      if (currentUserId === userId && !data.roles.includes('admin')) {
        throw new Error('Cannot remove your own admin role');
      }
      updateData.role = JSON.stringify(data.roles);
    }
    if (data.is_active !== undefined) {
      if (userId === currentUserId && !data.is_active) throw new Error('Cannot deactivate your own account');
      updateData.is_active = data.is_active ? 1 : 0;
    }
    if (data.password) {
      updateData.password_hash = await bcrypt.hash(data.password, 10);
    }

    if (Object.keys(updateData).length > 0) {
      await userRepo.update(userId, updateData);
    }

    if (data.beneficiaryIds && Array.isArray(data.beneficiaryIds)) {
      const bRepo = new BaseRepository(db, 'beneficiary_members');
      await bRepo.deleteWhere({ user_id: userId });
      for (const bId of data.beneficiaryIds) {
        await bRepo.create({ id: crypto.randomUUID(), beneficiary_id: bId, user_id: userId });
      }
    }
  }

  static async deleteUser(userId: string, currentUserId: string) {
    if (userId === currentUserId) throw new Error('Cannot deactivate yourself');
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user) throw new Error('User not found');
    await userRepo.update(userId, { is_active: 0 });
  }

  static async getConfig() {
    const repo = new BaseRepository(getDb(), 'system_config');
    const items = await repo.findWhere({});
    return items.map((i: any) => ({ key: i.key, value: i.value }));
  }

  static async getPublicConfig() {
    const publicKeys = [
      'investigation_debug', 
      'default_kill_chain_type', 
      'allow_api_tokens', 
      'kill_chain_event_type_mapping', 
      'session_lock_enabled', 
      'session_lock_timeout',
      'force_session_lock',
      'allow_diamond_deletion',
      'allow_comment_editing',
      'allow_comment_deletion'
    ];
    const repo = new BaseRepository(getDb(), 'system_config');
    const items = await repo.findWhere({});
    const configMap: Record<string, any> = {};
    for (const item of items) {
      if (publicKeys.includes(item.key)) configMap[item.key] = item.value;
    }
    return configMap;
  }

  static async updateConfig(key: string, value: string) {
    const db = getDb();
    await db.query(`UPSERT { key: @key } INSERT { key: @key, value: @val } UPDATE { value: @val } IN system_config`, {
      key,
      val: String(value),
    });
  }

  static async getBeneficiaries() {
    const db = getDb();
    const cursor = await db.query(`
      FOR b IN beneficiaries
      SORT b.name ASC
      LET ms = (FOR m IN beneficiary_members FILTER m.beneficiary_id == b._key RETURN 1)
      RETURN MERGE(b, { id: b._key, member_count: LENGTH(ms) })
    `);
    return await cursor.all();
  }

  static async getBeneficiaryMembers(beneficiaryId: string) {
    const db = getDb();
    const cursor = await db.query(`
      FOR m IN beneficiary_members
      FILTER m.beneficiary_id == @bId
      LET u = (FOR user IN user_profiles FILTER user._key == m.user_id RETURN user)[0]
      RETURN { id: m._key, beneficiary_id: m.beneficiary_id, user_id: m.user_id, full_name: u.full_name, email: u.email, is_team_lead: m.is_team_lead, role: m.role }
    `, { bId: beneficiaryId });
    return await cursor.all();
  }

  static async updateBeneficiaryMemberTeamLead(memberId: string, isTeamLead: boolean) {
    const repo = new BaseRepository(getDb(), 'beneficiary_members');
    await repo.update(memberId, { is_team_lead: isTeamLead ? 1 : 0 });
  }

  static async updateBeneficiaryMemberRole(memberId: string, roles: string[]) {
    const repo = new BaseRepository(getDb(), 'beneficiary_members');
    await repo.update(memberId, { role: JSON.stringify(roles) });
  }

  static async createBeneficiary(name: string, description?: string) {
    const repo = new BaseRepository(getDb(), 'beneficiaries');
    const existing = await repo.findWhere({ name });
    if (existing.length > 0) throw new Error('Beneficiary name already exists');

    const id = crypto.randomUUID();
    await repo.create({ id, name, description: description || '' });
    return id;
  }

  static async updateBeneficiary(id: string, name?: string, description?: string) {
    const repo = new BaseRepository(getDb(), 'beneficiaries');
    
    if (name !== undefined) {
      const existing = await repo.findWhere({ name });
      if (existing.length > 0 && existing[0].id !== id) throw new Error('Beneficiary name already exists');
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      await repo.update(id, updateData);
    }
  }

  static async deleteBeneficiary(id: string) {
    const repo = new BaseRepository(getDb(), 'beneficiaries');
    await repo.delete(id);
  }

  static async addBeneficiaryMember(beneficiaryId: string, userId: string) {
    const repo = new BaseRepository(getDb(), 'beneficiary_members');
    const existing = await repo.findWhere({ beneficiary_id: beneficiaryId, user_id: userId });
    if (existing.length > 0) throw new Error('User is already a member of this beneficiary');

    const id = crypto.randomUUID();
    await repo.create({ id, beneficiary_id: beneficiaryId, user_id: userId });
    return id;
  }

  static async removeBeneficiaryMember(memberId: string) {
    const repo = new BaseRepository(getDb(), 'beneficiary_members');
    await repo.delete(memberId);
  }
}
