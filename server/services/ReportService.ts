import { getDb } from '../db-arango';
import { getTlpColor, getPapColor } from '../utils/colors';

export class ReportService {
  static async getCaseReportData(caseId: string) {
    const db = getDb();

    const caseCursor = await db.query(
      `
            FOR c IN cases
            FILTER c._key == @caseId
            LET sev = (FOR s IN severities FILTER s._key == c.severity_id RETURN s)[0]
            LET author = (FOR u IN user_profiles FILTER u._key == c.author_id RETURN u)[0]
            LET closer = (FOR u IN user_profiles FILTER u._key == c.closed_by RETURN u)[0]
            RETURN MERGE(c, {
                id: c._key,
                severity_label: sev.label,
                severity_color: sev.color,
                author_name: author.full_name,
                author_email: author.email,
                closed_by_user_name: closer.full_name
            })
        `,
      { caseId }
    );

    const caseObj = await caseCursor.next();
    if (!caseObj) throw new Error('Case not found');

    const formattedCase = {
      ...caseObj,
      author: { full_name: caseObj.author_name },
      severity: caseObj.severity_label ? { label: caseObj.severity_label, color: caseObj.severity_color } : null,
      tlp: caseObj.tlp ? { code: caseObj.tlp, label: `TLP:${caseObj.tlp}`, color: getTlpColor(caseObj.tlp) } : null,
      pap: caseObj.pap ? { code: caseObj.pap, label: `PAP:${caseObj.pap}`, color: getPapColor(caseObj.pap) } : null,
      closed_by_user: caseObj.closed_by_user_name ? { full_name: caseObj.closed_by_user_name } : null,
    };

    const tasksCursor = await db.query(
      `
            FOR t IN tasks
            FILTER t.case_id == @caseId
            LET assignee = (FOR u IN user_profiles FILTER u._key == t.assigned_to RETURN u)[0]
            LET closer = (FOR u IN user_profiles FILTER u._key == t.closed_by RETURN u)[0]
            LET res = (FOR r IN task_results FILTER r._key == t.result_id RETURN r)[0]
            SORT t.created_at ASC
            RETURN MERGE(t, {
                id: t._key,
                assigned_to_user_name: assignee.full_name,
                closed_by_user_name: closer.full_name,
                result_label: res.label,
                result_color: res.color
            })
        `,
      { caseId }
    );

    const tasks = (await tasksCursor.all()).map((t: any) => ({
      ...t,
      assigned_to_user: t.assigned_to_user_name ? { full_name: t.assigned_to_user_name } : null,
      closed_by_user: t.closed_by_user_name ? { full_name: t.closed_by_user_name } : null,
      result: t.result_label ? { label: t.result_label, color: t.result_color } : null,
    }));

    const eventsCursor = await db.query(
      `
            LET observed_events = (
                FOR obj IN stix_objects
                FILTER obj.case_id == @caseId AND obj.data.type == 'observed-data'
                FILTER HAS(obj.data, 'first_observed')
                RETURN {
                    id: obj._key,
                    event_datetime: obj.data.first_observed,
                    kill_chain: obj.data.x_oris_kill_chain || null,
                    description: obj.data.x_oris_description || 'Observation',
                    task_id: obj.data.x_oris_task_id || null,
                    source_system: null,
                    target_system: null
                }
            )
            LET relationship_events = (
                FOR rel IN stix_relationships
                FILTER rel.case_id == @caseId
                FILTER HAS(rel.data, 'start_time')
                RETURN {
                    id: rel._key,
                    event_datetime: rel.data.start_time,
                    kill_chain: rel.data.x_oris_kill_chain || null,
                    description: CONCAT('Action : ', rel.data.relationship_type),
                    task_id: null,
                    source_system: null,
                    target_system: null
                }
            )
            FOR event IN APPEND(observed_events, relationship_events)
                SORT event.event_datetime ASC
                RETURN event
        `,
      { caseId }
    );
    const mappedEvents = await eventsCursor.all();

    const systemsCursor = await db.query(
      `
            FOR obj IN stix_objects
            FILTER obj.case_id == @caseId AND obj.data.type == 'infrastructure'
            SORT obj.data.name ASC
            RETURN {
                id: obj._key,
                name: obj.data.name,
                system_type: obj.data.infrastructure_types[0] || 'unknown',
                description: obj.data.description || '',
                ip_addresses: [],
                task_id: obj.data.x_oris_task_id || null
            }
        `,
      { caseId }
    );
    const systems = await systemsCursor.all();

    const mappedSystems = systems.map((s: any) => ({
      ...s,
      investigation_tasks: tasks
        .filter((t: any) => t.system_id === s.id)
        .map((t: any) => ({
          id: t.id,
          system_id: t.system_id,
          status: t.status,
          closed_at: t.closed_at,
          investigation_status: t.investigation_status,
          initial_investigation_status: t.initial_investigation_status,
        })),
    }));

    const accountsCursor = await db.query(
      `
            FOR obj IN stix_objects
            FILTER obj.case_id == @caseId AND obj.data.type == 'user-account'
            SORT obj.created_at ASC
            RETURN {
                id: obj._key,
                account_name: obj.data.user_id || obj.data.display_name || '',
                domain: '',
                privileges: ''
            }
        `,
      { caseId }
    );
    const accounts = await accountsCursor.all();

    const indicatorsCursor = await db.query(
      `
            FOR obj IN stix_objects
            FILTER obj.case_id == @caseId AND obj.data.type == 'indicator'
            SORT obj.created_at ASC
            RETURN {
                id: obj._key,
                name: obj.data.name || '',
                pattern: obj.data.pattern || '',
                pattern_type: obj.data.pattern_type || 'stix'
            }
        `,
      { caseId }
    );
    const indicators = await indicatorsCursor.all();

    const malwareCursor = await db.query(
      `
            FOR obj IN stix_objects
            FILTER obj.case_id == @caseId AND obj.data.type == 'malware'
            SORT obj.created_at ASC
            RETURN {
                id: obj._key,
                file_name: obj.data.name || '',
                description: obj.data.description || '',
                malware_types: obj.data.malware_types || []
            }
        `,
      { caseId }
    );
    const malware = await malwareCursor.all();

    const exfiltrations: any[] = [];

    return {
      caseData: formattedCase,
      tasks,
      events: mappedEvents,
      systems: mappedSystems,
      accounts,
      indicators,
      malware,
      exfiltrations,
    };
  }
}
