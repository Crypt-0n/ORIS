/**
 * Migration 004 — Kill Chain TTPs table
 * Stores TTPs (Tactics, Techniques, Procedures) per kill chain phase.
 * Editable from admin interface to track evolving TTPs.
 */
exports.up = async function(knex) {
    await knex.schema.createTable('kill_chain_ttps', t => {
        t.string('id', 191).primary();
        t.string('kill_chain_type', 100).notNullable();
        t.string('phase_value', 255).notNullable();
        t.string('ttp_id', 50).notNullable();
        t.string('name', 500).notNullable();
        t.text('description');
        t.integer('order').defaultTo(0);
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.table('kill_chain_ttps', t => {
        t.unique(['kill_chain_type', 'phase_value', 'ttp_id']);
        t.index(['kill_chain_type', 'phase_value']);
    });

    // Seed MITRE ATT&CK TTPs
    const crypto = require('crypto');
    const ttps = [
        // Reconnaissance
        { phase: 'att_reconnaissance', ttp_id: 'T1595', name: 'Active Scanning', desc: 'Scan actif de l\'infrastructure cible' },
        { phase: 'att_reconnaissance', ttp_id: 'T1592', name: 'Gather Victim Host Information', desc: 'Collecte d\'informations sur les hôtes cibles' },
        { phase: 'att_reconnaissance', ttp_id: 'T1589', name: 'Gather Victim Identity Information', desc: 'Collecte d\'informations d\'identité' },
        { phase: 'att_reconnaissance', ttp_id: 'T1590', name: 'Gather Victim Network Information', desc: 'Collecte d\'informations réseau' },
        { phase: 'att_reconnaissance', ttp_id: 'T1591', name: 'Gather Victim Org Information', desc: 'Collecte d\'informations organisationnelles' },
        { phase: 'att_reconnaissance', ttp_id: 'T1598', name: 'Phishing for Information', desc: 'Phishing pour la collecte d\'informations' },
        { phase: 'att_reconnaissance', ttp_id: 'T1597', name: 'Search Closed Sources', desc: 'Recherche dans les sources fermées' },
        { phase: 'att_reconnaissance', ttp_id: 'T1596', name: 'Search Open Technical Databases', desc: 'Recherche dans les bases techniques ouvertes' },
        { phase: 'att_reconnaissance', ttp_id: 'T1593', name: 'Search Open Websites/Domains', desc: 'Recherche sur les sites web ouverts' },
        // Resource Development
        { phase: 'att_resource_development', ttp_id: 'T1583', name: 'Acquire Infrastructure', desc: 'Acquisition d\'infrastructure' },
        { phase: 'att_resource_development', ttp_id: 'T1586', name: 'Compromise Accounts', desc: 'Compromission de comptes' },
        { phase: 'att_resource_development', ttp_id: 'T1584', name: 'Compromise Infrastructure', desc: 'Compromission d\'infrastructure' },
        { phase: 'att_resource_development', ttp_id: 'T1587', name: 'Develop Capabilities', desc: 'Développement de capacités' },
        { phase: 'att_resource_development', ttp_id: 'T1585', name: 'Establish Accounts', desc: 'Création de comptes' },
        { phase: 'att_resource_development', ttp_id: 'T1588', name: 'Obtain Capabilities', desc: 'Obtention de capacités' },
        // Initial Access
        { phase: 'att_initial_access', ttp_id: 'T1189', name: 'Drive-by Compromise', desc: 'Compromission par navigation web' },
        { phase: 'att_initial_access', ttp_id: 'T1190', name: 'Exploit Public-Facing Application', desc: 'Exploitation d\'application exposée' },
        { phase: 'att_initial_access', ttp_id: 'T1133', name: 'External Remote Services', desc: 'Services distants externes' },
        { phase: 'att_initial_access', ttp_id: 'T1200', name: 'Hardware Additions', desc: 'Ajout de matériel' },
        { phase: 'att_initial_access', ttp_id: 'T1566', name: 'Phishing', desc: 'Hameçonnage (pièces jointes, liens, services)' },
        { phase: 'att_initial_access', ttp_id: 'T1091', name: 'Replication Through Removable Media', desc: 'Réplication via média amovible' },
        { phase: 'att_initial_access', ttp_id: 'T1195', name: 'Supply Chain Compromise', desc: 'Compromission de la chaîne d\'approvisionnement' },
        { phase: 'att_initial_access', ttp_id: 'T1199', name: 'Trusted Relationship', desc: 'Relation de confiance' },
        { phase: 'att_initial_access', ttp_id: 'T1078', name: 'Valid Accounts', desc: 'Comptes valides' },
        // Execution
        { phase: 'att_execution', ttp_id: 'T1059', name: 'Command and Scripting Interpreter', desc: 'PowerShell, Bash, Python, etc.' },
        { phase: 'att_execution', ttp_id: 'T1203', name: 'Exploitation for Client Execution', desc: 'Exploitation pour exécution côté client' },
        { phase: 'att_execution', ttp_id: 'T1559', name: 'Inter-Process Communication', desc: 'Communication inter-processus' },
        { phase: 'att_execution', ttp_id: 'T1106', name: 'Native API', desc: 'API native' },
        { phase: 'att_execution', ttp_id: 'T1053', name: 'Scheduled Task/Job', desc: 'Tâche planifiée' },
        { phase: 'att_execution', ttp_id: 'T1047', name: 'Windows Management Instrumentation', desc: 'WMI' },
        { phase: 'att_execution', ttp_id: 'T1204', name: 'User Execution', desc: 'Exécution par l\'utilisateur' },
        // Persistence
        { phase: 'att_persistence', ttp_id: 'T1098', name: 'Account Manipulation', desc: 'Manipulation de comptes' },
        { phase: 'att_persistence', ttp_id: 'T1197', name: 'BITS Jobs', desc: 'Tâches BITS' },
        { phase: 'att_persistence', ttp_id: 'T1547', name: 'Boot or Logon Autostart Execution', desc: 'Exécution auto au démarrage ou à la connexion' },
        { phase: 'att_persistence', ttp_id: 'T1136', name: 'Create Account', desc: 'Création de compte' },
        { phase: 'att_persistence', ttp_id: 'T1543', name: 'Create or Modify System Process', desc: 'Création/modification de processus système' },
        { phase: 'att_persistence', ttp_id: 'T1546', name: 'Event Triggered Execution', desc: 'Exécution déclenchée par événement' },
        { phase: 'att_persistence', ttp_id: 'T1574', name: 'Hijack Execution Flow', desc: 'Détournement du flux d\'exécution' },
        { phase: 'att_persistence', ttp_id: 'T1505', name: 'Server Software Component', desc: 'Composant logiciel serveur (Web Shell)' },
        // Privilege Escalation
        { phase: 'att_privilege_escalation', ttp_id: 'T1548', name: 'Abuse Elevation Control Mechanism', desc: 'Abus du mécanisme de contrôle d\'élévation' },
        { phase: 'att_privilege_escalation', ttp_id: 'T1134', name: 'Access Token Manipulation', desc: 'Manipulation de jetons d\'accès' },
        { phase: 'att_privilege_escalation', ttp_id: 'T1068', name: 'Exploitation for Privilege Escalation', desc: 'Exploitation pour élévation de privilèges' },
        { phase: 'att_privilege_escalation', ttp_id: 'T1055', name: 'Process Injection', desc: 'Injection de processus' },
        // Defense Evasion
        { phase: 'att_defense_evasion', ttp_id: 'T1140', name: 'Deobfuscate/Decode Files or Information', desc: 'Désobfuscation / décodage' },
        { phase: 'att_defense_evasion', ttp_id: 'T1070', name: 'Indicator Removal', desc: 'Suppression d\'indicateurs' },
        { phase: 'att_defense_evasion', ttp_id: 'T1036', name: 'Masquerading', desc: 'Usurpation d\'identité de fichier' },
        { phase: 'att_defense_evasion', ttp_id: 'T1027', name: 'Obfuscated Files or Information', desc: 'Fichiers ou informations obfusqués' },
        { phase: 'att_defense_evasion', ttp_id: 'T1562', name: 'Impair Defenses', desc: 'Affaiblissement des défenses' },
        { phase: 'att_defense_evasion', ttp_id: 'T1112', name: 'Modify Registry', desc: 'Modification du registre' },
        // Credential Access
        { phase: 'att_credential_access', ttp_id: 'T1110', name: 'Brute Force', desc: 'Force brute' },
        { phase: 'att_credential_access', ttp_id: 'T1003', name: 'OS Credential Dumping', desc: 'Extraction de credentials (LSASS, SAM, etc.)' },
        { phase: 'att_credential_access', ttp_id: 'T1558', name: 'Steal or Forge Kerberos Tickets', desc: 'Vol/forge de tickets Kerberos' },
        { phase: 'att_credential_access', ttp_id: 'T1552', name: 'Unsecured Credentials', desc: 'Credentials non sécurisés' },
        { phase: 'att_credential_access', ttp_id: 'T1555', name: 'Credentials from Password Stores', desc: 'Credentials depuis les gestionnaires de mots de passe' },
        // Discovery
        { phase: 'att_discovery', ttp_id: 'T1087', name: 'Account Discovery', desc: 'Découverte de comptes' },
        { phase: 'att_discovery', ttp_id: 'T1482', name: 'Domain Trust Discovery', desc: 'Découverte des relations de confiance de domaine' },
        { phase: 'att_discovery', ttp_id: 'T1083', name: 'File and Directory Discovery', desc: 'Découverte de fichiers et répertoires' },
        { phase: 'att_discovery', ttp_id: 'T1046', name: 'Network Service Discovery', desc: 'Découverte de services réseau' },
        { phase: 'att_discovery', ttp_id: 'T1057', name: 'Process Discovery', desc: 'Découverte de processus' },
        { phase: 'att_discovery', ttp_id: 'T1018', name: 'Remote System Discovery', desc: 'Découverte de systèmes distants' },
        // Lateral Movement
        { phase: 'att_lateral_movement', ttp_id: 'T1021', name: 'Remote Services', desc: 'Services distants (RDP, SSH, SMB, WinRM)' },
        { phase: 'att_lateral_movement', ttp_id: 'T1570', name: 'Lateral Tool Transfer', desc: 'Transfert latéral d\'outils' },
        { phase: 'att_lateral_movement', ttp_id: 'T1550', name: 'Use Alternate Authentication Material', desc: 'Pass the Hash / Pass the Ticket' },
        { phase: 'att_lateral_movement', ttp_id: 'T1080', name: 'Taint Shared Content', desc: 'Contamination de contenu partagé' },
        // Collection
        { phase: 'att_collection', ttp_id: 'T1560', name: 'Archive Collected Data', desc: 'Archivage des données collectées' },
        { phase: 'att_collection', ttp_id: 'T1005', name: 'Data from Local System', desc: 'Données depuis le système local' },
        { phase: 'att_collection', ttp_id: 'T1039', name: 'Data from Network Shared Drive', desc: 'Données depuis un partage réseau' },
        { phase: 'att_collection', ttp_id: 'T1114', name: 'Email Collection', desc: 'Collecte d\'emails' },
        { phase: 'att_collection', ttp_id: 'T1113', name: 'Screen Capture', desc: 'Capture d\'écran' },
        // C2
        { phase: 'att_c2', ttp_id: 'T1071', name: 'Application Layer Protocol', desc: 'Protocole de couche application (HTTP, DNS, SMTP)' },
        { phase: 'att_c2', ttp_id: 'T1132', name: 'Data Encoding', desc: 'Encodage de données' },
        { phase: 'att_c2', ttp_id: 'T1573', name: 'Encrypted Channel', desc: 'Canal chiffré' },
        { phase: 'att_c2', ttp_id: 'T1105', name: 'Ingress Tool Transfer', desc: 'Transfert d\'outils entrant' },
        { phase: 'att_c2', ttp_id: 'T1572', name: 'Protocol Tunneling', desc: 'Tunneling de protocole' },
        { phase: 'att_c2', ttp_id: 'T1090', name: 'Proxy', desc: 'Proxy' },
        // Exfiltration
        { phase: 'att_exfiltration', ttp_id: 'T1041', name: 'Exfiltration Over C2 Channel', desc: 'Exfiltration via le canal C2' },
        { phase: 'att_exfiltration', ttp_id: 'T1048', name: 'Exfiltration Over Alternative Protocol', desc: 'Exfiltration via protocole alternatif' },
        { phase: 'att_exfiltration', ttp_id: 'T1567', name: 'Exfiltration Over Web Service', desc: 'Exfiltration via service web (cloud storage)' },
        { phase: 'att_exfiltration', ttp_id: 'T1029', name: 'Scheduled Transfer', desc: 'Transfert planifié' },
        // Impact
        { phase: 'att_impact', ttp_id: 'T1486', name: 'Data Encrypted for Impact', desc: 'Chiffrement de données (ransomware)' },
        { phase: 'att_impact', ttp_id: 'T1485', name: 'Data Destruction', desc: 'Destruction de données' },
        { phase: 'att_impact', ttp_id: 'T1489', name: 'Service Stop', desc: 'Arrêt de service' },
        { phase: 'att_impact', ttp_id: 'T1490', name: 'Inhibit System Recovery', desc: 'Inhibition de la récupération système' },
        { phase: 'att_impact', ttp_id: 'T1491', name: 'Defacement', desc: 'Défacement' },
    ];

    // Also seed UKC with the same TTPs where phase names match
    const ukcMappings = {
        'att_reconnaissance': 'ukc_reconnaissance',
        'att_initial_access': null, // UKC has exploitation + social_engineering instead
        'att_execution': 'ukc_execution',
        'att_persistence': 'ukc_persistence',
        'att_privilege_escalation': 'ukc_privilege_escalation',
        'att_defense_evasion': 'ukc_defense_evasion',
        'att_credential_access': 'ukc_credential_access',
        'att_discovery': 'ukc_discovery',
        'att_lateral_movement': 'ukc_lateral_movement',
        'att_collection': 'ukc_collection',
        'att_c2': 'ukc_c2',
        'att_exfiltration': 'ukc_exfiltration',
        'att_impact': 'ukc_impact',
    };

    const rows = [];
    let order = 0;

    for (const ttp of ttps) {
        rows.push({
            id: crypto.randomUUID(),
            kill_chain_type: 'mitre_attack',
            phase_value: ttp.phase,
            ttp_id: ttp.ttp_id,
            name: ttp.name,
            description: ttp.desc,
            order: order++,
        });

        // Map to UKC if applicable
        const ukcPhase = ukcMappings[ttp.phase];
        if (ukcPhase) {
            rows.push({
                id: crypto.randomUUID(),
                kill_chain_type: 'unified_kill_chain',
                phase_value: ukcPhase,
                ttp_id: ttp.ttp_id,
                name: ttp.name,
                description: ttp.desc,
                order: order++,
            });
        }
    }

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
        await knex('kill_chain_ttps').insert(rows.slice(i, i + 50));
    }
};

exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('kill_chain_ttps');
};
