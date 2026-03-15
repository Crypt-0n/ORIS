[🇫🇷 Français](README.md) | 🇬🇧 English

# ORIS — Security Incident Response Tool

<div align="center">

![Version](https://img.shields.io/badge/version-0.9_beta-blue)
![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen?logo=node.js)

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
- **Systems** — inventory of involved machines with investigation status
- **Malware / Tools** — malicious file tracking (names, hashes, classification)
- **Compromised accounts** — tracking with domain, SID, privileges, context
- **Network indicators (IOC)** — IPs, domains, URLs related to the attack
- **Exfiltrations** — volume, methods and destinations
- **Timeline** — interactive event chronology per system

### Attack modeling
- **Diamond Model** — adversary / infrastructure / capability / victim visualization
- **Kill Chain** — Lockheed Martin (7 phases), Unified Kill Chain (18 phases), MITRE ATT&CK (14 tactics)
- **Kill Chain × Systems Matrix** — phase/system cross-reference in matrix view
- **Activity Thread** — chronological view of activity segments per system
- **Lateral movement graph** — interactive attack path visualization
- **Role transition** — pivot system detection (victim → infrastructure)
- **MITRE ATT&CK TTPs** — built-in reference with search and tagging

### Task tracking
- Creation, assignment and qualification (system investigation, malware analysis, OSINT)
- Timestamped attachments and comments
- Key findings with automatic linking to investigation objects
- Closure with final status and summary

### Collaboration
- Real-time notifications (in-app + Web Push)
- Real-time presence (who is viewing which case)
- Complete and traceable audit log
- Multi-beneficiary with data partitioning

### Security
- **RBAC** — roles per beneficiary (`case_analyst`, `alert_analyst`, `case_viewer`, `alert_viewer`)
- **Session lock** — PIN-based lock screen
- **2FA** — TOTP support (Google Authenticator, Authy, etc.)
- **API tokens** — programmatic access with revocable tokens

### Export and backup
- **PDF report** — cover page, summary, timeline, full inventory, annexes
- **Built-in backup** — scheduled automatic backup (DB only or full with files)
- **Import/Export** — full restore from ZIP archive

## 🛠️ Tech stack

| Component | Stack |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | Node.js, Express, Knex.js |
| **Database** | SQLite, PostgreSQL or MariaDB/MySQL (your choice) |
| **Authentication** | JWT + bcrypt, TOTP (2FA) |
| **Notifications** | Web Push (VAPID) |
| **Containerization** | Docker, Docker Compose |

## 🚀 Docker deployment

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### Quick start

```bash
# SQLite (recommended to get started)
docker compose -f docker-compose.sqlite.yml up -d --build

# PostgreSQL
docker compose -f docker-compose.postgres.yml up -d --build

# MariaDB / MySQL
docker compose -f docker-compose.mysql.yml up -d --build
```

The application is available at **http://localhost** (port configurable in docker-compose).

### Configuration

Copy `.env.example` to `.env` and adjust the values:

```bash
cp .env.example .env
```

> **Important**: in production, set a strong `JWT_SECRET`. See `.env.example` for the generation command.

### Stop the application

```bash
docker compose -f docker-compose.<variant>.yml down
```

> To fully reset (including database): `docker compose down -v`

### Persistent volumes

| Volume | Content |
|---|---|
| `oris_*_data` | Database (SQLite only) |
| `oris_uploads` | Files attached to tasks and comments |
| `oris_avatars` | User profile pictures |
| `oris_backups` | Automatic backups |

## 💻 Local development

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### Run in development

```bash
# Backend (port 3001)
cd server && npm run dev

# Frontend (port 5173, in another terminal)
npm run dev
```

### Tests

```bash
cd server

# Regression tests
npx jest __tests__/knex_regression.test.js --forceExit

# API smoke tests
npx jest __tests__/demo_smoke.test.js --forceExit

# Full test suite
npx jest --forceExit
```

## 🏁 First launch

On first startup, the application redirects to an initial setup page to:

1. Create the **administrator account**
2. Choose the default **Kill Chain model**
3. Create the **first beneficiary** (organization)

Once initialization is complete, only an administrator can create new users from the admin panel.

## 📄 License

This project is distributed under the [AGPL-3.0](LICENSE) license.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or a pull request.

1. Fork the project
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request
