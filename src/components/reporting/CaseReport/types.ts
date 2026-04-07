export interface CaseReportData {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: string;
  closure_summary: string | null;
  closed_at: string | null;
  created_at: string;
  author: { full_name: string };
  severity: { label: string; color: string };
  tlp: { code: string; label: string; color: string };
  pap: { code: string; label: string; color: string };
  closed_by_user: { full_name: string } | null;
  attacker_utc_offset: number | null;
  kill_chain_type?: string | null;
}

export interface ReportTask {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  closure_comment: string | null;
  closed_at: string | null;
  assigned_to_user: { full_name: string } | null;
  closed_by_user: { full_name: string } | null;
  result: { label: string; color: string } | null;
}

export interface ReportTaskEvent {
  id: string;
  event_type?: string;
  event_datetime: string;
  created_at: string;
  task_id: string | null;
  description: string;
  direction: string | null;
  kill_chain: string | null;
  source_system: { name: string } | null;
  target_system: { name: string } | null;
}

export interface TaskComment {
  task_id: string;
  created_at: string;
}

export interface CaseEvent {
  event_datetime: string;
  created_at: string;
  event_type?: string;
  description: string;
}

export interface ReportSystemTask {
  id: string;
  status: string;
  closed_at: string | null;
  investigation_status: string | null;
  initial_investigation_status: string | null;
}

export interface ReportSystem {
  id: string;
  name: string;
  system_type: string;
  ip_addresses: { ip: string; mask: string; gateway: string }[];
  owner: string;
  investigation_tasks: ReportSystemTask[];
  computedStatus?: string;
}

export interface ReportCompromisedAccount {
  id: string;
  account_name: string;
  domain: string;
  sid: string | null;
  privileges: string;
  first_malicious_activity: string | null;
  last_malicious_activity: string | null;
  context: string | null;
  created_at: string;
}

export interface ReportNetworkIndicator {
  id: string;
  ip: string | null;
  domain_name: string | null;
  port: number | null;
  url: string | null;
  first_activity: string | null;
  last_activity: string | null;
  malware_file_name: string | null;
  created_at: string;
}

export interface ReportMalware {
  id: string;
  file_name: string;
  file_path: string | null;
  is_malicious: boolean | null;
  creation_date: string | null;
  system_name: string | null;
  created_at: string;
}

export interface ReportExfiltration {
  id: string;
  exfiltration_date: string | null;
  file_name: string | null;
  file_size: number | null;
  file_size_unit: string | null;
  content_description: string | null;
  source_system_name: string | null;
  exfil_system_name: string | null;
  destination_system_name: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user_full_name: string;
}

export type ReportType = 'full' | 'daily' | 'weekly';
