🇫🇷 Français | [🇬🇧 English](README.en.md)

# ORIS — Outil de Réponse aux Incidents de Sécurité

<div align="center">

![Version](https://img.shields.io/badge/version-0.9_beta-blue)
![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen?logo=node.js)

**Plateforme collaborative de réponse aux incidents de cybersécurité**

*Conçue pour les équipes CERT, SOC et CSIRT*

</div>

---

> [!WARNING]
> **Version bêta** — Ce logiciel est en cours de développement actif. Des changements incompatibles (_breaking changes_) peuvent survenir entre les mises à jour. Il est recommandé de **sauvegarder vos données régulièrement** et de consulter les notes de version avant chaque mise à jour.

## 🔍 Aperçu

ORIS est une application web auto-hébergée pour piloter les investigations de cybersécurité. Elle permet aux équipes de sécurité d'organiser leurs dossiers d'incidents, de modéliser les attaques, de suivre l'avancement des tâches d'investigation et de collaborer efficacement dans un environnement cloisonné et sécurisé.

## ✨ Fonctionnalités

### Gestion des dossiers
- **Cases** — incidents de sécurité avec sévérité, TLP/PAP, bénéficiaire et cycle de vie complet
- **Alertes** — événements précurseurs pouvant être escaladés en cases
- **Dashboard** — vue d'ensemble en temps réel (dossiers critiques, statistiques, activité récente)

### Investigation
- **Systèmes** — inventaire des machines impliquées avec statut d'investigation
- **Malwares / Outils** — référencement des fichiers malveillants (noms, hashes, classification)
- **Comptes compromis** — suivi avec domaine, SID, privilèges, contexte
- **Indicateurs réseau (IOC)** — IP, domaines, URLs liés à l'attaque
- **Exfiltrations** — volumétrie, méthodes et destinations
- **Timeline** — chronologie interactive des événements par système

### Modélisation des attaques
- **Modèle Diamond** — visualisation adversaire / infrastructure / capacité / victime
- **Kill Chain** — Lockheed Martin (7 phases), Unified Kill Chain (18 phases), MITRE ATT&CK (14 tactiques)
- **Matrice Kill Chain × Systèmes** — croisement phases/systèmes en vue matricielle
- **Activity Thread** — vue chronologique des segments d'activité par système
- **Graphe de propagation latérale** — visualisation interactive des chemins d'attaque
- **Transition de rôle** — détection des systèmes pivots (victime → infrastructure)
- **TTPs MITRE ATT&CK** — référentiel intégré avec recherche et tagging

### Suivi des tâches
- Création, assignation et qualification (investigation système, analyse malware, OSINT)
- Pièces jointes et commentaires horodatés
- Faits marquants avec liaison automatique aux objets d'investigation
- Fermeture avec statut final et bilan

### Collaboration
- Notifications en temps réel (in-app + Web Push)
- Présence en temps réel (qui consulte quel dossier)
- Journal d'audit complet et traçable
- Multi-bénéficiaires avec cloisonnement des données

### Sécurité
- **RBAC** — rôles par bénéficiaire (`case_analyst`, `alert_analyst`, `case_viewer`, `alert_viewer`)
- **Verrouillage de session** — écran de verrouillage par code PIN
- **2FA** — support TOTP (Google Authenticator, Authy, etc.)
- **Jetons API** — accès programmatique avec tokens révocables

### Export et sauvegarde
- **Rapport PDF** — page de garde, synthèse, chronologie, inventaire complet, annexes
- **Backup intégré** — sauvegarde automatique planifiée (BDD seule ou complète avec fichiers)
- **Import/Export** — restauration complète depuis une archive ZIP

## 🛠️ Technologies

| Composant | Stack |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | Node.js, Express, Knex.js |
| **Base de données** | SQLite, PostgreSQL ou MariaDB/MySQL (au choix) |
| **Authentification** | JWT + bcrypt, TOTP (2FA) |
| **Notifications** | Web Push (VAPID) |
| **Conteneurisation** | Docker, Docker Compose |

## 🚀 Déploiement avec Docker

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/install/)

### Lancement rapide

```bash
# SQLite (recommandé pour commencer)
docker compose -f docker-compose.sqlite.yml up -d --build

# PostgreSQL
docker compose -f docker-compose.postgres.yml up -d --build

# MariaDB / MySQL
docker compose -f docker-compose.mysql.yml up -d --build
```

L'application est accessible sur **http://localhost** (port configurable dans le docker-compose).

### Configuration

Copier `.env.example` en `.env` et adapter les valeurs :

```bash
cp .env.example .env
```

> **Important** : en production, définissez un `JWT_SECRET` fort. Voir `.env.example` pour la commande de génération.

### Arrêter l'application

```bash
docker compose -f docker-compose.<variante>.yml down
```

> Pour réinitialiser complètement (base de données incluse) : `docker compose down -v`

### Volumes persistants

| Volume | Contenu |
|---|---|
| `oris_*_data` | Base de données (SQLite uniquement) |
| `oris_uploads` | Fichiers joints aux tâches et commentaires |
| `oris_avatars` | Images de profil des utilisateurs |
| `oris_backups` | Sauvegardes automatiques |

## 💻 Développement local

### Prérequis

- Node.js 20+
- npm

### Installation

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### Lancer en développement

```bash
# Backend (port 3001)
cd server && npm run dev

# Frontend (port 5173, dans un autre terminal)
npm run dev
```

### Tests

```bash
cd server

# Tests de non-régression
npx jest __tests__/knex_regression.test.js --forceExit

# Tests de fumée API
npx jest __tests__/demo_smoke.test.js --forceExit

# Tests complets
npx jest --forceExit
```

## 🏁 Premier lancement

Au premier démarrage, l'application redirige vers une page de configuration initiale pour :

1. Créer le **compte administrateur**
2. Choisir le **modèle de Kill Chain** par défaut
3. Créer le **premier bénéficiaire** (organisation)

Une fois l'initialisation terminée, seul un administrateur peut créer de nouveaux utilisateurs depuis le panneau d'administration.

## 📄 Licence

Ce projet est distribué sous licence [AGPL-3.0](LICENSE).

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

1. Forkez le projet
2. Créez votre branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commitez vos changements (`git commit -m 'feat: ajout de ma fonctionnalité'`)
4. Poussez vers la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrez une Pull Request
