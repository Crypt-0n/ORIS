import { useTranslation } from 'react-i18next';
import { Book, Lock, Globe, Code, ChevronRight, Tags, Database, Activity } from 'lucide-react';

interface EndpointProps {
    method: string;
    path: string;
    description: string;
    params?: string[];
    response?: string;
}

function Endpoint({ method, path, description, params, response }: EndpointProps) {
    const methodColor = {
        GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        POST: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }[method] || 'bg-gray-100 text-gray-700';

    return (
        <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden mb-4 bg-white dark:bg-slate-900/50">
            <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${methodColor}`}>{method}</span>
                <code className="text-sm font-mono text-gray-800 dark:text-slate-200">{path}</code>
                <span className="text-xs text-gray-500 dark:text-slate-400 ml-auto">{description}</span>
            </div>
            {(params || response) && (
                <div className="p-4 space-y-4">
                    {params && params.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Parameters</h4>
                            <ul className="space-y-1">
                                {params.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs">
                                        <ChevronRight className="w-3 h-3 text-blue-500 mt-0.5" />
                                        <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded text-pink-600 dark:text-pink-400">{p.split(':')[0]}</code>
                                        <span className="text-gray-600 dark:text-slate-300">{p.split(':')[1]}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {response && (
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Response</h4>
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                                {response}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function ApiDocs() {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Book className="w-8 h-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('apiDocs.title')}</h1>
                </div>
                <p className="text-gray-600 dark:text-slate-400">{t('apiDocs.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                    <div className="flex items-center gap-2 mb-3">
                        <Lock className="w-5 h-5 text-blue-600" />
                        <h2 className="font-bold text-gray-900 dark:text-white">{t('apiDocs.authTitle')}</h2>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed mb-4">
                        {t('apiDocs.authDesc')}
                    </p>
                    <code className="block bg-white dark:bg-slate-900 p-3 rounded-lg text-xs border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 whitespace-pre">
                        Authorization: Bearer &lt;your_token&gt;
                    </code>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-5 h-5 text-purple-600" />
                        <h2 className="font-bold text-gray-900 dark:text-white">{t('apiDocs.baseUrlTitle')}</h2>
                    </div>
                    <p className="text-sm text-purple-800 dark:text-purple-300 leading-relaxed mb-4">
                        {t('apiDocs.baseUrlDesc')}
                    </p>
                    <code className="block bg-white dark:bg-slate-900 p-3 rounded-lg text-xs border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400">
                        {window.location.origin}/api
                    </code>
                </div>
            </div>

            <div className="space-y-12">
                {/* Authentication */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Lock className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Authentication</h3>
                    </div>
                    <Endpoint
                        method="POST"
                        path="/auth/login"
                        description="Authentification et obtention d'un jeton JWT"
                        params={["email: Adresse email (Body)", "password: Mot de passe (Body)"]}
                        response={`{
  "user": { "id": "uuid", "email": "...", "user_metadata": { "full_name": "...", "role": ["user"] } },
  "session": { "access_token": "jwt_token_here" }
}`}
                    />
                    <Endpoint
                        method="GET"
                        path="/auth/me"
                        description="Récupérer le profil de l'utilisateur connecté"
                        response={`{
  "user": { "id": "uuid", "email": "...", "full_name": "...", "role": ["user"], "is_active": true }
}`}
                    />
                    <Endpoint
                        method="PUT"
                        path="/auth/password"
                        description="Changer de mot de passe"
                        params={["currentPassword: Mot de passe actuel", "newPassword: Nouveau mot de passe"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/auth/api-tokens"
                        description="Lister vos jetons API personnels"
                    />
                    <Endpoint
                        method="POST"
                        path="/auth/api-tokens"
                        description="Créer un nouveau jeton API"
                        params={["name: Nom descriptif du jeton (Body)"]}
                        response={`{ "id": "uuid", "name": "...", "token": "oris_tk_..." }`}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/auth/api-tokens/:id"
                        description="Supprimer un jeton API"
                        params={["id: UUID du jeton (Path)"]}
                    />
                </section>

                {/* Cases */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Tags className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Dossiers (Cases)</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/cases"
                        description="Lister tous les dossiers accessibles"
                        response={`[
  { 
    "id": "uuid", 
    "case_number": "2026-00001", 
    "title": "...", 
    "status": "open",
    "tlp": { "code": "AMBER", "color": "#FFC000" },
    "severity": { "label": "High", "color": "#ef4444" }
  }
]`}
                    />
                    <Endpoint
                        method="GET"
                        path="/cases/:id"
                        description="Détails complets d'un dossier spécifique"
                        params={["id: UUID du dossier (Path)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/cases"
                        description="Créer un nouveau dossier"
                        params={[
                            "title: Titre du dossier (Body)",
                            "description: Contenu HTML (Body)",
                            "severity_id: UUID de la sévérité (Body)",
                            "beneficiary_id: UUID du bénéficiaire (Body)",
                            "tlp: 'RED' | 'AMBER' | 'GREEN' | 'CLEAR' (Body)",
                            "pap: 'RED' | 'AMBER' | 'GREEN' | 'CLEAR' (Body)",
                            "kill_chain_type: 'cyber_kill_chain' | 'unified_kill_chain' | 'mitre_attack' (Body)"
                        ]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/cases/:id"
                        description="Modifier les métadonnées d'un dossier"
                        params={[
                            "id: UUID du dossier (Path)",
                            "status: 'open' | 'closed' (Body)",
                            "severity_id: UUID sévérité (Body)",
                            "tlp: TLP code (Body)",
                            "pap: PAP code (Body)",
                            "beneficiary_id: UUID bénéficiaire (Body)",
                            "attacker_utc_offset: Décalage horaire (Body)"
                        ]}
                    />
                    <Endpoint
                        method="POST"
                        path="/case_assignments"
                        description="Inviter un membre de l'organisation dans un dossier"
                        params={["case_id: UUID du dossier (Body)", "user_id: UUID de l'utilisateur (Body)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/case_assignments/:id"
                        description="Retirer un membre d'un dossier"
                        params={["id: UUID de l'assignation (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/cases/:id"
                        description="Supprimer un dossier (Admin uniquement)"
                        params={["id: UUID du dossier (Path)"]}
                    />
                </section>

                {/* Alerts */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Alertes</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/cases?type=alert"
                        description="Lister toutes les alertes accessibles"
                        response={`[
  { 
    "id": "uuid", 
    "case_number": "2026-00001", 
    "type": "alert",
    "title": "...", 
    "status": "open"
  }
]`}
                    />
                    <Endpoint
                        method="POST"
                        path="/cases"
                        description="Créer une nouvelle alerte"
                        params={[
                            "title: Titre (Body)",
                            "description: Contenu HTML (Body)",
                            "severity_id: UUID de la sévérité (Body)",
                            "beneficiary_id: UUID du bénéficiaire (Body)",
                            "type: 'alert' (Body)",
                            "tlp: TLP code (Body)",
                            "pap: PAP code (Body)"
                        ]}
                    />
                    <Endpoint
                        method="POST"
                        path="/cases/:id/convert"
                        description="Convertir une alerte en dossier (case_manager requis)"
                        params={["id: UUID de l'alerte (Path)"]}
                        response={`{ "success": true, "id": "uuid" }`}
                    />
                </section>

                {/* Investigation */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Investigation</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/investigation/:type/by-case/:caseId"
                        description="Lister les entités d'un dossier"
                        params={[
                            "type: 'systems' | 'events' | 'indicators' | 'malware' | 'exfiltrations' | 'accounts' | 'diamond' (Path)",
                            "caseId: UUID du dossier (Path)"
                        ]}
                    />
                    <Endpoint
                        method="POST"
                        path="/investigation/:type"
                        description="Créer une nouvelle entité d'investigation"
                        params={[
                            "type: Type d'entité (Path)",
                            "payload: Objet complet selon le type (Body)"
                        ]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/investigation/:type/:id"
                        description="Modifier une entité d'investigation"
                        params={[
                            "type: Type d'entité (Path)",
                            "id: UUID de l'entité (Path)",
                            "payload: Champs à modifier (Body)"
                        ]}
                    />
                    <Endpoint
                        method="GET"
                        path="/investigation/account_systems/:caseId"
                        description="Lister les liens comptes/systèmes d'un dossier"
                        params={["caseId: UUID du dossier (Path)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/investigation/account_systems"
                        description="Lier des comptes compromis à des systèmes"
                        params={["body: Tableau de { account_id, system_id } (Body)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/investigation/severities"
                        description="Lister les niveaux de sévérité disponibles"
                    />
                    <Endpoint
                        method="GET"
                        path="/investigation/tlp"
                        description="Lister les codes TLP disponibles"
                    />
                    <Endpoint
                        method="GET"
                        path="/investigation/pap"
                        description="Lister les codes PAP disponibles"
                    />
                    <Endpoint
                        method="DELETE"
                        path="/investigation/:type/:id"
                        description="Supprimer une entité d'investigation"
                        params={["type: Type d'entité (Path)", "id: UUID de l'entité (Path)"]}
                    />
                </section>

                {/* Tasks & Collaboration */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Code className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Tâches & Collaboration</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/tasks/my-tasks"
                        description="Récupérer toutes les tâches assignées ou non-assignées accessibles"
                        params={[
                            "page: Numéro de page, 0 = tout (Query, Opt)",
                            "limit: Nombre max de résultats par page (Query, Opt)"
                        ]}
                        response={`{
  "assigned": [{ "id": "uuid", "title": "...", "status": "open", "case": { ... } }],
  "unassigned": [{ "id": "uuid", "title": "...", "status": "open", "case": { ... } }]
}`}
                    />
                    <Endpoint
                        method="GET"
                        path="/tasks/by-case/:caseId"
                        description="Récupérer les tâches d'un dossier"
                        params={["caseId: UUID du dossier (Path)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/tasks/:id"
                        description="Détails complets d'une tâche"
                        params={["id: UUID de la tâche (Path)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/tasks"
                        description="Créer une tâche d'investigation"
                        params={[
                            "case_id: UUID du dossier (Body)",
                            "title: Titre (Body)",
                            "description: Contenu HTML (Body)",
                            "assigned_to: UUID utilisateur (Body)",
                            "system_id: UUID système lié (Body, Opt)",
                            "malware_id: UUID malware lié (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/tasks/:id"
                        description="Modifier une tâche"
                        params={[
                            "id: UUID de la tâche (Path)",
                            "title: Titre (Body, Opt)",
                            "description: Contenu (Body, Opt)",
                            "assigned_to: UUID utilisateur (Body, Opt)",
                            "status: 'open' | 'closed' (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="POST"
                        path="/tasks/:id/close"
                        description="Clôturer une tâche avec un commentaire"
                        params={[
                            "id: UUID de la tâche (Path)",
                            "closure_comment: Commentaire de clôture (Body)",
                            "investigation_status: Status final (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="GET"
                        path="/comments/by-task/:taskId"
                        description="Lister les commentaires d'une tâche"
                        params={["taskId: UUID de la tâche (Path)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/comments"
                        description="Ajouter un commentaire à une tâche"
                        params={["task_id: UUID de la tâche (Body)", "content: Contenu HTML (Body)"]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/comments/:id"
                        description="Modifier un commentaire"
                        params={["id: UUID du commentaire (Path)", "content: Nouveau contenu (Body)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/files/upload"
                        description="Uploader une pièce jointe pour une tâche"
                        params={[
                            "caseId: UUID du dossier (Body)",
                            "taskId: UUID de la tâche (Body)",
                            "file: Fichier binaire (Form-Data)"
                        ]}
                    />
                    <Endpoint
                        method="GET"
                        path="/files/task/:taskId"
                        description="Lister les fichiers attachés à une tâche"
                        params={["taskId: UUID de la tâche (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/files/:id"
                        description="Supprimer une pièce jointe"
                        params={["id: UUID du fichier (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/tasks/:id"
                        description="Supprimer une tâche"
                        params={["id: UUID de la tâche (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/comments/:id"
                        description="Supprimer un commentaire"
                        params={["id: UUID du commentaire (Path)"]}
                    />
                </section>

                {/* Dashboard & Search */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard & Recherche</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/dashboard"
                        description="Statistiques du tableau de bord (dossiers/alertes ouverts et fermés)"
                        response={`{
  "openCasesCount": 5,
  "closedCasesCount": 12,
  "openAlertsCount": 3,
  "closedAlertsCount": 8,
  "admin": true
}`}
                    />
                    <Endpoint
                        method="GET"
                        path="/search?q=terme"
                        description="Recherche globale dans les dossiers, alertes et tâches"
                        params={["q: Terme de recherche (Query)"]}
                        response={`{
  "cases": [{ "id": "uuid", "title": "...", "case_number": "..." }],
  "tasks": [{ "id": "uuid", "title": "...", "case_id": "..." }]
}`}
                    />
                </section>

                {/* Notifications */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Notifications</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/notifications"
                        description="Lister toutes les notifications de l'utilisateur"
                    />
                    <Endpoint
                        method="GET"
                        path="/notifications/unread-count"
                        description="Nombre de notifications non lues"
                        response={`{ "count": 5 }`}
                    />
                    <Endpoint
                        method="PUT"
                        path="/notifications/:id/read"
                        description="Marquer une notification comme lue"
                        params={["id: UUID de la notification (Path)"]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/notifications/read-all"
                        description="Marquer toutes les notifications comme lues"
                    />
                    <Endpoint
                        method="DELETE"
                        path="/notifications/all"
                        description="Supprimer toutes les notifications"
                    />
                    <Endpoint
                        method="POST"
                        path="/notifications/subscribe"
                        description="Souscrire aux notifications Web Push"
                        params={["subscription: Objet PushSubscription complet (Body)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/notifications/preferences"
                        description="Récupérer les préférences de notification"
                    />
                    <Endpoint
                        method="PUT"
                        path="/notifications/preferences"
                        description="Modifier les préférences de notification"
                        params={["preferences: Objet de préférences (Body)"]}
                    />
                </section>

                {/* 2FA */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Lock className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Authentification 2FA (TOTP)</h3>
                    </div>
                    <Endpoint
                        method="POST"
                        path="/auth/2fa/setup"
                        description="Générer un secret TOTP et un QR code pour activer la 2FA"
                        response={`{ "secret": "BASE32...", "qrCode": "data:image/png;base64,...", "uri": "otpauth://..." }`}
                    />
                    <Endpoint
                        method="POST"
                        path="/auth/2fa/enable"
                        description="Activer la 2FA après vérification d'un code TOTP"
                        params={["code: Code TOTP à 6 chiffres (Body)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/auth/2fa/disable"
                        description="Désactiver la 2FA"
                        params={["code: Code TOTP de vérification (Body)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/auth/verify-2fa"
                        description="Vérifier un code 2FA lors de la connexion"
                        params={["temp_token: Token temporaire reçu au login (Body)", "code: Code TOTP (Body)"]}
                    />
                </section>

                {/* Backup */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Database className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Sauvegarde & Restauration</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/backup"
                        description="Lister les sauvegardes existantes"
                    />
                    <Endpoint
                        method="POST"
                        path="/backup"
                        description="Créer une sauvegarde (BDD seule)"
                    />
                    <Endpoint
                        method="POST"
                        path="/backup/full"
                        description="Créer une sauvegarde complète (BDD + fichiers + avatars)"
                    />
                    <Endpoint
                        method="GET"
                        path="/backup/download/:name"
                        description="Télécharger un fichier de sauvegarde"
                        params={["name: Nom du fichier backup (Path)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/backup/restore-admin"
                        description="Restaurer depuis un fichier ZIP uploadé (Admin)"
                        params={["file: Fichier ZIP de backup (Form-Data)"]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/backup/config"
                        description="Modifier la configuration des sauvegardes automatiques"
                        params={[
                            "interval: Intervalle en heures (Body, Opt)",
                            "retention: Nombre de backups à conserver (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/backup/:name"
                        description="Supprimer une sauvegarde"
                        params={["name: Nom du fichier (Path)"]}
                    />
                </section>

                {/* Webhooks */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Webhooks</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/webhooks"
                        description="Lister tous les webhooks configurés"
                    />
                    <Endpoint
                        method="POST"
                        path="/webhooks"
                        description="Créer un webhook"
                        params={[
                            "url: URL du webhook (Body)",
                            "events: Tableau d'événements à écouter (Body)",
                            "secret: Secret HMAC pour la signature (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/webhooks/:id"
                        description="Modifier un webhook"
                        params={[
                            "id: UUID du webhook (Path)",
                            "url: URL (Body, Opt)",
                            "events: Événements (Body, Opt)",
                            "active: true | false (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="POST"
                        path="/webhooks/:id/test"
                        description="Envoyer un événement test au webhook"
                        params={["id: UUID du webhook (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/webhooks/:id"
                        description="Supprimer un webhook"
                        params={["id: UUID du webhook (Path)"]}
                    />
                </section>

                {/* TTPs */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Tags className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">TTPs MITRE ATT&CK</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/admin/ttps"
                        description="Lister les TTPs personnalisés"
                    />
                    <Endpoint
                        method="POST"
                        path="/admin/ttps"
                        description="Créer un TTP personnalisé (Admin)"
                        params={[
                            "technique_id: ID MITRE (ex: T1059) (Body)",
                            "name: Nom de la technique (Body)",
                            "tactic: Tactique associée (Body)"
                        ]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/admin/ttps/:id"
                        description="Modifier un TTP (Admin)"
                        params={["id: UUID du TTP (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/admin/ttps/:id"
                        description="Supprimer un TTP (Admin)"
                        params={["id: UUID du TTP (Path)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/config/ttps"
                        description="Lister tous les TTPs disponibles (référentiel + personnalisés)"
                    />
                </section>

                {/* Admin & Audit */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Database className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Admin & Audit</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/audit/case/:caseId"
                        description="Récupérer les logs d'audit complets d'un dossier"
                        params={["caseId: UUID du dossier (Path)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/admin/setup-status"
                        description="Vérifier si l'application est initialisée (pas d'auth requise)"
                        response={`{ "hasAdmin": true, "isInitialized": true }`}
                    />
                    <Endpoint
                        method="GET"
                        path="/admin/users"
                        description="Lister tous les utilisateurs (Admin)"
                    />
                    <Endpoint
                        method="POST"
                        path="/admin/users"
                        description="Créer un utilisateur (Admin)"
                        params={[
                            "email: Email (Body)",
                            "password: Password (Body)",
                            "fullName: Nom complet (Body)",
                            "roles: Tableau de rôles (Body)",
                            "beneficiaryIds: Tableau d'IDs bénéficiaires (Body)"
                        ]}
                    />
                    <Endpoint
                        method="PUT"
                        path="/admin/users/:id"
                        description="Modifier un utilisateur (Admin)"
                        params={[
                            "id: UUID utilisateur (Path)",
                            "full_name: Nom (Body, Opt)",
                            "role: Tableau de rôles (Body, Opt)",
                            "is_active: true | false (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="POST"
                        path="/admin/beneficiaries"
                        description="Créer un bénéficiaire (Admin)"
                        params={["name: Nom (Body)", "description: Description (Body)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/admin/beneficiaries"
                        description="Lister tous les bénéficiaires configurés"
                    />
                    <Endpoint
                        method="GET"
                        path="/admin/beneficiaries/:id/members"
                        description="Lister les membres d'un bénéficiaire"
                        params={["id: UUID du bénéficiaire (Path)"]}
                    />
                    <Endpoint
                        method="POST"
                        path="/admin/beneficiaries/:id/members"
                        description="Ajouter un membre à un bénéficiaire"
                        params={["id: UUID bénéficiaire (Path)", "user_id: UUID utilisateur (Body)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/admin/users/:id"
                        description="Supprimer un utilisateur (Admin)"
                        params={["id: UUID utilisateur (Path)"]}
                    />
                    <Endpoint
                        method="DELETE"
                        path="/admin/beneficiaries/:id"
                        description="Supprimer un bénéficiaire (Admin)"
                        params={["id: UUID bénéficiaire (Path)"]}
                    />
                    <Endpoint
                        method="GET"
                        path="/admin/config"
                        description="Récupérer la configuration système (Admin)"
                    />
                    <Endpoint
                        method="PUT"
                        path="/admin/config"
                        description="Modifier une clé de configuration (Admin)"
                        params={["key: Clé (Ex: allow_api_tokens) (Body)", "value: Valeur (Body)"]}
                    />
                </section>

                {/* Reports */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Book className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Rapports</h3>
                    </div>
                    <Endpoint
                        method="GET"
                        path="/reports/case/:id"
                        description="Extraction consolidée de toutes les données d'un dossier pour génération de rapport"
                        params={["id: UUID du dossier (Path)"]}
                    />
                </section>

                {/* Présence */}
                <section>
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-800 pb-2">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Présence en temps réel</h3>
                    </div>
                    <Endpoint
                        method="POST"
                        path="/presence/heartbeat"
                        description="Envoyer un heartbeat de présence (maintient l'utilisateur actif)"
                        params={[
                            "caseId: UUID du dossier consulté (Body, Opt)",
                            "taskId: UUID de la tâche consultée (Body, Opt)"
                        ]}
                    />
                    <Endpoint
                        method="GET"
                        path="/presence/case/:caseId"
                        description="Voir les utilisateurs actuellement sur un dossier"
                        params={["caseId: UUID du dossier (Path)"]}
                    />
                </section>
            </div>

            <div className="mt-16 p-8 bg-gray-50 dark:bg-slate-900 rounded-3xl text-center border border-dashed border-gray-200 dark:border-slate-800">
                <Code className="w-10 h-10 text-gray-300 dark:text-slate-700 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-gray-700 dark:text-white mb-2">Besoin d'aide ?</h4>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                    Pour des intégrations plus poussées ou des accès programmatiques spécifiques, contactez votre administrateur ORIS.
                </p>
            </div>
        </div>
    );
}
