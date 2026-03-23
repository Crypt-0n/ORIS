[🇫🇷 Français](README.md) | 🇬🇧 English

# ORIS — Security Incident Response Tool

<div align="center">

![Version](https://img.shields.io/badge/version-0.9_beta-blue)
![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen?logo=node.js)
![ArangoDB](https://img.shields.io/badge/ArangoDB-3.12-red?logo=arangodb)
![Lighthouse](https://img.shields.io/badge/lighthouse-100%2F100%2F100%2F100-brightgreen)

**Collaborative cybersecurity incident response platform**

*Designed for CERT, SOC and CSIRT teams*

</div>

---

> [!WARNING]
> **Beta version** — This software is under active development. Breaking changes may occur between updates. It is recommended to **back up your data regularly** and review release notes before each update.

## 🔍 Overview

ORIS is a self-hosted web application for managing cybersecurity investigations. It enables security teams to organize incident cases, model attacks, track investigation tasks and collaborate effectively in a partitioned and secure environment.

## ✨ Features

### Case management
- **Cases** — security incidents with severity, TLP/PAP, beneficiary and full lifecycle
- **Alerts** — precursor events that can be escalated to cases
- **Dashboard** — real-time overview (critical cases, statistics, recent activity)

### Investigation
- **Systems** — inventory of involved machines with investigation status (compromised, infected, clean)
- **Malware / Tools** — malicious file tracking (names, hashes, classification)
- **Compromised accounts** — tracking with domain, SID, privileges, context
- **Network indicators (IOC)** — IPs, domains, URLs related to the attack
- **Exfiltrations** — volume, methods and destinations
- **Attacker infrastructure** — C2 servers, VPNs and adversary infrastructure
- **Timeline** — interactive event chronology per system
- **Security recommendations** — progression axes for systems and infrastructure

### Attack modeling
- **Diamond Model** — adversary / infrastructure / capability / victim visualization
- **Kill Chain** — Lockheed Martin (7 phases), Unified Kill Chain (18 phases), MITRE ATT&CK (14 tactics)
- **Kill Chain × Systems Matrix** — phase/system cross-reference in matrix view
- **Activity Thread** — chronological view of activity segments per system with legend and tags
- **Lateral movement graph** — interactive attack path visualization between systems
- **Visual timeline** — graphical representation of attack phases with kill chain color coding
- **Activity charts** — temporal distribution diagrams of events
- **Chronological tree** — Dagre hierarchical view of event relationships
- **Role transition** — pivot system detection (victim → infrastructure)
- **MITRE ATT&CK TTPs** — built-in reference with search, tagging and mapping

### Interoperability
- **STIX 2.1** — full investigation data export in STIX 2.1 format (JSON bundles)
- **REST API documentation** — built-in API docs in the application (swagger-like)

### Task tracking
- Creation, assignment and qualification (system investigation, malware analysis, OSINT…)
- Timestamped attachments and comments with rich text editor
- Key findings with automatic linking to investigation objects
- Closure with final status (investigation result) and summary
- Deep linking — notifications link directly to the relevant task or comment

### Collaboration
- Real-time notifications (in-app + Web Push)
- @mentions in comments
- Real-time presence (who is viewing which case)
- Complete and traceable audit log
- Multi-beneficiary with data partitioning

### Security
- **RBAC** — roles per beneficiary (`case_analyst`, `alert_analyst`, `case_viewer`, `alert_viewer`)
- **Session lock** — admin-configurable PIN-based lock screen
- **2FA** — TOTP support (Google Authenticator, Authy, etc.)
- **API tokens** — programmatic access with revocable tokens

### Export and backup
- **PDF report** — cover page, summary, timeline, full inventory, graphs, annexes
- **Periodic reports** — daily or weekly with temporal filtering
- **Built-in backup** — scheduled automatic backup (DB only or full with files)
- **Import/Export** — full restore from ZIP archive

### PWA
- **Progressive Web App** — installable on mobile and desktop
- **Offline** — offline support with smart caching
- **Web Push** — push notifications even when app is closed

## 🛠️ Tech stack

| Component | Stack |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, CSS (dark mode) |
| **Backend** | Node.js, Express |
| **Database** | ArangoDB 3.12 (graph + document) |
| **Authentication** | JWT + bcrypt, TOTP (2FA) |
| **Notifications** | Web Push (VAPID) |
| **Containerization** | Docker, Docker Compose |
| **Testing** | Jest + supertest |

## 🚀 Docker deployment

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### Quick start

```bash
docker compose up -d --build
```

The application is available at **http://localhost:3457** (port configurable in `docker-compose.yml`).

### Service architecture

| Service | Image | Port |
|---|---|---|
| `arangodb` | ArangoDB 3.12 | 8529 (admin UI) |
| `backend` | Node.js/Express | 3001 (internal) |
| `frontend` | Nginx + React SPA | 3457 → 80 |

### Stop the application

```bash
docker compose down
```

> To fully reset (including database): `docker compose down -v`

### Persistent volumes

| Volume | Content |
|---|---|
| `oris_arangodata` | ArangoDB data |
| `oris_arangoapps` | ArangoDB apps |
| `oris_uploads` | Files attached to tasks and comments |
| `oris_avatars` | User profile pictures |
| `oris_backups` | Automatic backups |

## 💻 Local development

### Prerequisites

- Node.js 20+
- npm
- ArangoDB 3.12 (local or Docker)

### Installation

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### Run in development

```bash
# ArangoDB (if not already running)
docker compose up -d arangodb

# Backend (port 3001)
cd server && npm run dev

# Frontend (port 5173, in another terminal)
npm run dev
```

### Environment variables (backend)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API server port |
| `ARANGO_URL` | `http://localhost:8529` | ArangoDB URL |
| `ARANGO_DB` | `oris` | Database name |
| `ARANGO_USER` | `root` | ArangoDB user |
| `ARANGO_PASSWORD` | `oris_secret` | ArangoDB password |
| `JWT_SECRET` | `dev_secret_*` | JWT secret (required in production) |

> **Important**: in production, set a strong `JWT_SECRET`:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Tests

```bash
cd server

# Full API tests
npx jest __tests__/api.test.js --forceExit

# STIX 2.1 tests
npx jest __tests__/stix.test.js --forceExit

# STIX compliance tests
npx jest __tests__/stix-compliance.test.js --forceExit

# MITRE ATT&CK TTPs tests
npx jest __tests__/ttps.test.js --forceExit

# Full test suite
npx jest --forceExit
```

## 🏁 First launch

On first startup, the application redirects to an initial setup page to:

1. Create the **administrator account**
2. Choose the default **Kill Chain model**
3. Create the **first beneficiary** (organization)

Once initialization is complete, only an administrator can create new users from the admin panel.

## 📊 API Documentation

API documentation is built into the application and accessible from the **API Docs** menu (authenticated users). It covers all endpoints: authentication, cases, alerts, tasks, investigation, STIX 2.1, notifications, administration, and more.

## 📄 License

This project is distributed under the [AGPL-3.0](LICENSE) license.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or a pull request.

1. Fork the project
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request
