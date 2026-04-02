const fs = require('fs');

function fixValues(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      let val = obj[key];
      // Regex replace whole words
      val = val.replace(/\bcases\b/g, 'dossiers');
      val = val.replace(/\bCase\b/g, 'Dossier');
      val = val.replace(/\bCases\b/g, 'Dossiers');
      val = val.replace(/\bcase\b/g, 'dossier');
      
      // Some special ones
      val = val.replace(/Aucun case/g, 'Aucun dossier');
      val = val.replace(/nouveau case/g, 'nouveau dossier');
      val = val.replace(/Nouveau case/g, 'Nouveau dossier');
      val = val.replace(/le case/g, 'le dossier');
      val = val.replace(/ce case/g, 'ce dossier');
      val = val.replace(/du case/g, 'du dossier');
      val = val.replace(/nouveaux cases/g, 'nouveaux dossiers');
      val = val.replace(/cases existants/g, 'dossiers existants');

      obj[key] = val;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      fixValues(obj[key]);
    }
  }
}

const file = 'src/i18n/locales/fr.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Now add the missing keys in audit.actions!
if (!data.audit) data.audit = { actions: {}, fields: {} };
if (!data.audit.actions) data.audit.actions = {};

// We want to add these translated actions
const newActionsFr = {
    "case_updated": "Dossier modifié",
    "case_updated_with_changes": "Dossier modifié ({{changes}})",
    "alert_closed": "Alerte fermée",
    "timezone_changed": "Fuseau horaire modifié ({{oldValue}} → {{newValue}})", 
    "timezone_changed_with_changes": "Fuseau horaire modifié ({{changes}})",
    "member_added": "{{performed_by_name}} a ajouté {{user_name}}",
    "member_removed": "{{performed_by_name}} a retiré {{user_name}}",
    "leader_assigned": "{{performed_by_name}} a assigné {{user_name}} comme Team Leader",
    "leader_removed": "{{performed_by_name}} a retiré {{user_name}} du rôle Team Leader",
    "stix_object_created": "{{user}} a ajouté un élément STIX au dossier",
    "stix_object_created_with_changes": "{{user}} a ajouté un élément STIX au dossier",
    "stix_object_updated": "{{user}} a modifié un élément STIX du dossier",
    "stix_object_updated_with_changes": "{{user}} a modifié un élément STIX du dossier",
    "stix_object_deleted": "{{user}} a supprimé un élément STIX du dossier",
    "stix_object_deleted_with_changes": "{{user}} a supprimé un élément STIX du dossier",
    "stix_relationship_created": "{{user}} a lié deux éléments STIX",
    "stix_relationship_created_with_changes": "{{user}} a lié deux éléments STIX",
    "stix_relationship_updated": "{{user}} a modifié le lien entre deux éléments STIX",
    "stix_relationship_updated_with_changes": "{{user}} a modifié le lien entre deux éléments STIX",
    "stix_relationship_deleted": "{{user}} a supprimé un lien entre deux éléments STIX",
    "stix_relationship_deleted_with_changes": "{{user}} a supprimé un lien entre deux éléments STIX"
};

for (const [k, v] of Object.entries(newActionsFr)) {
  if (!data.audit.actions[k]) {
    data.audit.actions[k] = v;
  }
}

fixValues(data);
fs.writeFileSync(file, JSON.stringify(data, null, 4));

const fileEn = 'src/i18n/locales/en.json';
const dataEn = JSON.parse(fs.readFileSync(fileEn, 'utf8'));

if (!dataEn.audit) dataEn.audit = { actions: {}, fields: {} };
if (!dataEn.audit.actions) dataEn.audit.actions = {};

const newActionsEn = {
    "case_updated": "Case updated",
    "case_updated_with_changes": "Case updated ({{changes}})",
    "alert_closed": "Alert closed",
    "timezone_changed": "Timezone changed ({{oldValue}} → {{newValue}})", 
    "timezone_changed_with_changes": "Timezone changed ({{changes}})",
    "member_added": "{{performed_by_name}} added {{user_name}}",
    "member_removed": "{{performed_by_name}} removed {{user_name}}",
    "leader_assigned": "{{performed_by_name}} assigned {{user_name}} as Team Leader",
    "leader_removed": "{{performed_by_name}} removed {{user_name}} from Team Leader role",
    "stix_object_created": "{{user}} added a STIX element to the case",
    "stix_object_created_with_changes": "{{user}} added a STIX element to the case",
    "stix_object_updated": "{{user}} modified a STIX element in the case",
    "stix_object_updated_with_changes": "{{user}} modified a STIX element in the case",
    "stix_object_deleted": "{{user}} removed a STIX element from the case",
    "stix_object_deleted_with_changes": "{{user}} removed a STIX element from the case",
    "stix_relationship_created": "{{user}} linked two STIX elements",
    "stix_relationship_created_with_changes": "{{user}} linked two STIX elements",
    "stix_relationship_updated": "{{user}} modified the link between two STIX elements",
    "stix_relationship_updated_with_changes": "{{user}} modified the link between two STIX elements",
    "stix_relationship_deleted": "{{user}} removed a link between two STIX elements",
    "stix_relationship_deleted_with_changes": "{{user}} removed a link between two STIX elements"
};

for (const [k, v] of Object.entries(newActionsEn)) {
  if (!dataEn.audit.actions[k]) {
    dataEn.audit.actions[k] = v;
  }
}

fs.writeFileSync(fileEn, JSON.stringify(dataEn, null, 4));

console.log("Translations updated!");
