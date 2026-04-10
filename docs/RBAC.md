# RBAC — Contrôle d'accès basé sur les rôles / Role-Based Access Control

> 🇫🇷 **[Version française](#-modèle-rbac-v3)** — 🇬🇧 **[English version](#-rbac-v3-model)**

---

## 🇫🇷 Modèle RBAC V3

### Architecture

ORIS utilise un modèle de permissions à **deux niveaux** :

1. **Rôle global** (`user_profiles.role`) — Seuls deux états existent :
   - `["admin"]` — Accès total à toutes les ressources
   - `[]` — Utilisateur standard, permissions déléguées aux rôles par bénéficiaire

2. **Rôles par bénéficiaire** (`beneficiary_members.role`) — Permissions spécifiques par organisation :
   - `case_analyst` — Lecture, création, modification et suppression des dossiers (cases)
   - `case_viewer` — Lecture seule des dossiers
   - `case_user` — Lecture et contribution limitée sur les dossiers
   - `case_manager` — Gestion complète des dossiers
   - `alert_analyst` — Lecture, création, modification et suppression des alertes
   - `alert_viewer` — Lecture seule des alertes
   - `alert_user` — Lecture et contribution limitée sur les alertes
   - `alert_manager` — Gestion complète des alertes

3. **Team Lead** (`beneficiary_members.is_team_lead`) — Droit supplémentaire de **clôturer** les dossiers/alertes pour un bénéficiaire donné.

### Hiérarchie des niveaux d'accès

```
manager (2)  ←  Peut gérer (CRUD complet + clôture)
   ↑
analyst (1)  ←  Peut créer, modifier, supprimer
   ↑
user (1)     ←  Peut contribuer (commentaires, fichiers)
   ↑
viewer (0)   ←  Lecture seule
```

> Un `case_analyst` a automatiquement les droits de `case_viewer` et `case_user`.

### Séparation Cases / Alertes

Les droits sont **strictement séparés** par type d'entité :

| Rôle | Cases | Alertes |
|------|-------|---------|
| `case_analyst` | ✅ CRUD | ❌ Aucun accès |
| `case_viewer` | ✅ Lecture | ❌ Aucun accès |
| `alert_analyst` | ❌ Aucun accès | ✅ CRUD |
| `alert_viewer` | ❌ Aucun accès | ✅ Lecture |
| `admin` | ✅ Total | ✅ Total |

Un utilisateur peut avoir **plusieurs rôles combinés** (ex: `["case_analyst", "alert_viewer"]`) pour accéder aux deux types.

### Restriction TLP (Traffic Light Protocol)

Les cases classifiés **TLP:RED** ou **TLP:AMBER+STRICT** ont un accès restreint :

| TLP | Qui peut accéder |
|-----|------------------|
| `WHITE` / `GREEN` | Tous les membres du bénéficiaire |
| `AMBER` | Tous les membres du bénéficiaire |
| `AMBER+STRICT` | ⚠️ **Admin + auteur + assignés uniquement** |
| `RED` | 🔒 **Admin + auteur + assignés uniquement** |

> Un **team lead** ou un **case_analyst** membre du même bénéficiaire **ne peut PAS** accéder à un case TLP:RED s'il n'est pas explicitement assigné à ce case.

### Contrôle d'accès aux dossiers

Un utilisateur peut accéder à un dossier spécifique si **au moins une** de ces conditions est vraie :

1. Il est **administrateur** global
2. Il est **l'auteur** du dossier
3. Il est **explicitement assigné** au dossier (`case_assignments`)
4. Il est **membre du bénéficiaire** auquel le dossier est rattaché

### Routes protégées

| Route | Protection |
|-------|-----------|
| `GET /api/cases` | Filtrage automatique par bénéficiaire accessible |
| `GET /api/cases/:id` | Vérification membership bénéficiaire |
| `POST /api/cases` | Rôle `analyst`+ sur le type (case/alert) du bénéficiaire |
| `PUT /api/cases/:id` (clôture) | `team_lead` ou `admin` requis |
| `DELETE /api/cases/:id` | Rôle `analyst`+ ou auteur |
| `PUT /api/tasks/:id` | `analyst`+ OU créateur OU assigné |
| `GET /api/comments/by-task/:id` | Accès au dossier parent requis |
| `POST /api/comments` | Accès au dossier parent requis |
| `GET /api/files/task/:id` | Accès au dossier parent requis |
| `POST /api/files/upload` | Accès au dossier parent requis |
| `/api/admin/*` | `admin` global uniquement |
| `/api/webhooks/*` | `admin` global uniquement |

### Fichiers de référence

| Fichier | Rôle |
|---------|------|
| [`server/utils/access.js`](../server/utils/access.js) | Toute la logique RBAC centralisée |
| [`server/repositories/CaseRepository.js`](../server/repositories/CaseRepository.js) | Filtrage AQL par accès |
| [`src/contexts/AuthContext.tsx`](../src/contexts/AuthContext.tsx) | Helpers frontend `hasRole()` / `hasAnyRole()` |
| [`server/__tests__/rbac.test.js`](../server/__tests__/rbac.test.js) | Suite de tests RBAC (63 tests) |
| [`src/contexts/__tests__/AuthRoles.test.tsx`](../src/contexts/__tests__/AuthRoles.test.tsx) | Tests frontend RBAC (9 tests) |

---

## 🇬🇧 RBAC V3 Model

### Architecture

ORIS uses a **two-tier** permission model:

1. **Global role** (`user_profiles.role`) — Only two states exist:
   - `["admin"]` — Full access to all resources
   - `[]` — Standard user, permissions delegated to per-beneficiary roles

2. **Per-beneficiary roles** (`beneficiary_members.role`) — Organization-specific permissions:
   - `case_analyst` — Read, create, edit and delete cases
   - `case_viewer` — Read-only access to cases
   - `case_user` — Read and limited contribution on cases
   - `case_manager` — Full case management
   - `alert_analyst` — Read, create, edit and delete alerts
   - `alert_viewer` — Read-only access to alerts
   - `alert_user` — Read and limited contribution on alerts
   - `alert_manager` — Full alert management

3. **Team Lead** (`beneficiary_members.is_team_lead`) — Additional right to **close** cases/alerts for a given beneficiary.

### Access Level Hierarchy

```
manager (2)  ←  Can manage (full CRUD + close)
   ↑
analyst (1)  ←  Can create, edit, delete
   ↑
user (1)     ←  Can contribute (comments, files)
   ↑
viewer (0)   ←  Read only
```

> A `case_analyst` automatically inherits `case_viewer` and `case_user` rights.

### Case / Alert Separation

Rights are **strictly separated** by entity type:

| Role | Cases | Alerts |
|------|-------|--------|
| `case_analyst` | ✅ CRUD | ❌ No access |
| `case_viewer` | ✅ Read | ❌ No access |
| `alert_analyst` | ❌ No access | ✅ CRUD |
| `alert_viewer` | ❌ No access | ✅ Read |
| `admin` | ✅ Full | ✅ Full |

A user can have **multiple combined roles** (e.g., `["case_analyst", "alert_viewer"]`) to access both types.

### TLP Restrictions (Traffic Light Protocol)

Cases classified as **TLP:RED** or **TLP:AMBER+STRICT** have restricted access:

| TLP | Who can access |
|-----|----------------|
| `WHITE` / `GREEN` | All beneficiary members |
| `AMBER` | All beneficiary members |
| `AMBER+STRICT` | ⚠️ **Admin + author + assigned users only** |
| `RED` | 🔒 **Admin + author + assigned users only** |

> A **team lead** or **case_analyst** who is a beneficiary member but **NOT explicitly assigned** to a TLP:RED case **cannot** access it.

### Case-Level Access Control

A user can access a specific case if **at least one** of these conditions is true:

1. They are a global **administrator**
2. They are the **author** of the case
3. They are **explicitly assigned** to the case (`case_assignments`)
4. They are a **member of the beneficiary** the case belongs to

### Protected Routes

| Route | Protection |
|-------|-----------|
| `GET /api/cases` | Auto-filtered by accessible beneficiary |
| `GET /api/cases/:id` | Beneficiary membership check |
| `POST /api/cases` | `analyst`+ role on the beneficiary for entity type |
| `PUT /api/cases/:id` (close) | `team_lead` or `admin` required |
| `DELETE /api/cases/:id` | `analyst`+ role or author |
| `PUT /api/tasks/:id` | `analyst`+ OR creator OR assignee |
| `GET /api/comments/by-task/:id` | Parent case access required |
| `POST /api/comments` | Parent case access required |
| `GET /api/files/task/:id` | Parent case access required |
| `POST /api/files/upload` | Parent case access required |
| `/api/admin/*` | Global `admin` only |
| `/api/webhooks/*` | Global `admin` only |

### Frontend Integration

The `AuthContext` provides two helpers for conditional UI rendering:

```tsx
const { hasRole, hasAnyRole, profile } = useAuth();

// Check single role
if (hasRole('admin')) { /* show admin panel */ }

// Check any of multiple roles
if (hasAnyRole(['case_analyst', 'case_manager'])) { /* show create button */ }

// Server-computed visibility flags
if (profile.canSeeCases) { /* show cases sidebar item */ }
if (profile.canSeeAlerts) { /* show alerts sidebar item */ }
```

### Reference Files

| File | Purpose |
|------|---------|
| [`server/utils/access.js`](../server/utils/access.js) | All RBAC logic centralized |
| [`server/repositories/CaseRepository.js`](../server/repositories/CaseRepository.js) | AQL access filtering |
| [`src/contexts/AuthContext.tsx`](../src/contexts/AuthContext.tsx) | Frontend `hasRole()` / `hasAnyRole()` helpers |
| [`server/__tests__/rbac.test.js`](../server/__tests__/rbac.test.js) | Backend RBAC test suite (63 tests) |
| [`src/contexts/__tests__/AuthRoles.test.tsx`](../src/contexts/__tests__/AuthRoles.test.tsx) | Frontend RBAC tests (9 tests) |
