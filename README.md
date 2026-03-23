🇫🇷 Français | [🇬🇧 English](README.en.md)

# ORIS — Outil de Réponse aux Incidents de Sécurité

<div align="center">

![Version](https://img.shields.io/badge/version-0.9_beta-blue)
![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen?logo=node.js)
![ArangoDB](https://img.shields.io/badge/ArangoDB-3.12-red?logo=arangodb)

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
- **Systèmes** — inventaire des machines impliquées avec statut d'investigation (compromis, infecté, sain)
- **Malwares / Outils** — référencement des fichiers malveillants (noms, hashes, classification)
- **Comptes compromis** — suivi avec domaine, SID, privilèges, contexte
- **Indicateurs réseau (IOC)** — IP, domaines, URLs liés à l'attaque
- **Exfiltrations** — volumétrie, méthodes et destinations
- **Infrastructure attaquant** — serveurs C2, VPN et infrastructure de l'adversaire
- **Timeline** — chronologie interactive des événements par système
- **Axes de progression** — recommandations de sécurité pour les systèmes et infrastructures

### Modélisation des attaques
- **Modèle Diamond** — visualisation adversaire / infrastructure / capacité / victime
- **Kill Chain** — Lockheed Martin (7 phases), Unified Kill Chain (18 phases), MITRE ATT&CK (14 tactiques)
- **Matrice Kill Chain × Systèmes** — croisement phases/systèmes en vue matricielle
- **Activity Thread** — vue chronologique des segments d'activité par système avec légende et tags
- **Graphe de propagation latérale** — visualisation interactive des chemins d'attaque entre systèmes
- **Timeline visuelle** — représentation graphique des phases d'attaque avec code couleur par kill chain
- **Graphiques d'activité** — diagrammes de distribution temporelle des événements
- **Arbre chronologique** — vue hiérarchique Dagre des relations entre événements
- **Transition de rôle** — détection des systèmes pivots (victime → infrastructure)
- **TTPs MITRE ATT&CK** — référentiel intégré avec recherche, tagging et mapping

### Interopérabilité
- **STIX 2.1** — export complet des données d'investigation au format STIX 2.1 (bundles JSON)
- **API REST documentée** — documentation intégrée à l'application (swagger-like)

### Suivi des tâches
- Création, assignation et qualification (investigation système, analyse malware, OSINT…)
- Pièces jointes et commentaires horodatés avec éditeur riche
- Faits marquants avec liaison automatique aux objets d'investigation
- Fermeture avec statut final (résultat d'investigation) et bilan
- Deep linking — les notifications renvoient directement à la tâche ou au commentaire concerné

### Collaboration
- Notifications en temps réel (in-app + Web Push)
- Mentions (@utilisateur) dans les commentaires
- Présence en temps réel (qui consulte quel dossier)
- Journal d'audit complet et traçable
- Multi-bénéficiaires avec cloisonnement des données

### Sécurité
- **RBAC** — rôles par bénéficiaire (`case_analyst`, `alert_analyst`, `case_viewer`, `alert_viewer`)
- **Verrouillage de session** — écran de verrouillage par code PIN configurable par l'admin
- **2FA** — support TOTP (Google Authenticator, Authy, etc.)
- **Jetons API** — accès programmatique avec tokens révocables

### Export et sauvegarde
- **Rapport PDF** — page de garde, synthèse, chronologie, inventaire complet, graphes, annexes
- **Rapports périodiques** — quotidiens ou hebdomadaires avec filtrage temporel
- **Backup intégré** — sauvegarde automatique planifiée (BDD seule ou complète avec fichiers)
- **Import/Export** — restauration complète depuis une archive ZIP

### PWA
- **Progressive Web App** — installation sur mobile et bureau
- **Offline** — fonctionnement hors-ligne avec cache intelligent
- **Web Push** — notifications push même application fermée

## 🛠️ Technologies

| Composant | Stack |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, CSS (dark mode) |
| **Backend** | Node.js, Express |
| **Base de données** | ArangoDB 3.12 (graphe + document) |
| **Authentification** | JWT + bcrypt, TOTP (2FA) |
| **Notifications** | Web Push (VAPID) |
| **Conteneurisation** | Docker, Docker Compose |
| **Tests** | Jest + supertest |

## 🚀 Déploiement avec Docker

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/install/)

### Lancement rapide

```bash
docker compose up -d --build
```

L'application est accessible sur **http://localhost:3457** (port configurable dans `docker-compose.yml`).

### Architecture des services

| Service | Image | Port |
|---|---|---|
| `arangodb` | ArangoDB 3.12 | 8529 (admin UI) |
| `backend` | Node.js/Express | 3001 (interne) |
| `frontend` | Nginx + SPA React | 3457 → 80 |

### Arrêter l'application

```bash
docker compose down
```

> Pour réinitialiser complètement (base de données incluse) : `docker compose down -v`

### Volumes persistants

| Volume | Contenu |
|---|---|
| `oris_arangodata` | Données ArangoDB |
| `oris_arangoapps` | Applications ArangoDB |
| `oris_uploads` | Fichiers joints aux tâches et commentaires |
| `oris_avatars` | Images de profil des utilisateurs |
| `oris_backups` | Sauvegardes automatiques |

## 💻 Développement local

### Prérequis

- Node.js 20+
- npm
- ArangoDB 3.12 (local ou Docker)

### Installation

```bash
# Frontend
npm install

# Backend
cd server && npm install
```

### Lancer en développement

```bash
# ArangoDB (si pas déjà lancé)
docker compose up -d arangodb

# Backend (port 3001)
cd server && npm run dev

# Frontend (port 5173, dans un autre terminal)
npm run dev
```

### Variables d'environnement (backend)

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port du serveur API |
| `ARANGO_URL` | `http://localhost:8529` | URL ArangoDB |
| `ARANGO_DB` | `oris` | Nom de la base |
| `ARANGO_USER` | `root` | Utilisateur ArangoDB |
| `ARANGO_PASSWORD` | `oris_secret` | Mot de passe ArangoDB |
| `JWT_SECRET` | `dev_secret_*` | Secret JWT (obligatoire en production) |

> **Important** : en production, définissez un `JWT_SECRET` fort :
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Tests

```bash
cd server

# Tests API complets
npx jest __tests__/api.test.js --forceExit

# Tests STIX 2.1
npx jest __tests__/stix.test.js --forceExit

# Tests conformité STIX
npx jest __tests__/stix-compliance.test.js --forceExit

# Tests TTPs MITRE ATT&CK
npx jest __tests__/ttps.test.js --forceExit

# Suite complète
npx jest --forceExit
```

## 🏁 Premier lancement

Au premier démarrage, l'application redirige vers une page de configuration initiale pour :

1. Créer le **compte administrateur**
2. Choisir le **modèle de Kill Chain** par défaut
3. Créer le **premier bénéficiaire** (organisation)

Une fois l'initialisation terminée, seul un administrateur peut créer de nouveaux utilisateurs depuis le panneau d'administration.

## 📊 Documentation API

La documentation API est intégrée à l'application et accessible depuis le menu **API Docs** (utilisateurs authentifiés). Elle couvre tous les endpoints : authentification, dossiers, alertes, tâches, investigation, STIX 2.1, notifications, administration, etc.

## 📄 Licence

Ce projet est distribué sous licence [AGPL-3.0](LICENSE).

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

1. Forkez le projet
2. Créez votre branche (`git checkout -b feature/ma-fonctionnalite`)
3. Commitez vos changements (`git commit -m 'feat: ajout de ma fonctionnalité'`)
4. Poussez vers la branche (`git push origin feature/ma-fonctionnalite`)
5. Ouvrez une Pull Request
