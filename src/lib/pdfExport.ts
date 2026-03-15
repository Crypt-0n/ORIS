import jsPDF from 'jspdf';
import logoUrl from '../assets/Logo.png';
import i18n from '../i18n/config';

export interface PdfCaseData {
  case_number: string;
  title: string;
  description: string;
  status: string;
  closure_summary: string | null;
  closed_at: string | null;
  created_at: string;
  author: { full_name: string };
  severity: { label: string };
  tlp: { code: string; label: string; color: string };
  pap: { code: string; label: string; color: string };
  closed_by_user: { full_name: string } | null;
}

export interface PdfTask {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  closure_comment: string | null;
  closed_at: string | null;
  assigned_to_user: { full_name: string } | null;
  closed_by_user: { full_name: string } | null;
  result: { label: string } | null;
}

export interface PdfTaskEvent {
  event_type?: string;
  event_datetime: string;
  direction: string | null;
  kill_chain: string | null;
  source_system: { name: string } | null;
  target_system: { name: string } | null;
}

export interface PdfSystem {
  id: string;
  name: string;
  system_type: string;
  ip_addresses: { ip: string }[];
  owner: string;
  computedStatus: string;
}

export interface PdfCompromisedAccount {
  account_name: string;
  domain: string;
  sid: string | null;
  privileges: string;
  first_malicious_activity: string | null;
  last_malicious_activity: string | null;
}

export interface PdfMalware {
  file_name: string;
  file_path: string | null;
  is_malicious: boolean | null;
  creation_date: string | null;
  system_name: string | null;
}

export interface PdfNetworkIndicator {
  ip: string | null;
  domain_name: string | null;
  port: number | null;
  url: string | null;
  first_activity: string | null;
  last_activity: string | null;
  malware_file_name: string | null;
}

export interface PdfExfiltration {
  exfiltration_date: string | null;
  file_name: string | null;
  file_size: number | null;
  file_size_unit: string | null;
  content_description: string | null;
  source_system_name: string | null;
  exfil_system_name: string | null;
  destination_system_name: string | null;
}

export interface PdfReportInput {
  caseData: PdfCaseData;
  tasks: PdfTask[];
  taskEventsMap: Record<string, PdfTaskEvent[]>;
  firstEvent: string | null;
  lastEvent: string | null;
  reportType: 'full' | 'daily' | 'weekly';
  periodLabel?: string;
  taskActivityMap?: Record<string, boolean>;
  historicalStatusMap?: Record<string, string>;
  attackerUtcOffset?: number | null;
  attackerSystems?: PdfSystem[];
  compromisedSystems?: PdfSystem[];
  compromisedAccounts?: PdfCompromisedAccount[];
  malwareTools?: PdfMalware[];
  networkIndicators?: PdfNetworkIndicator[];
  exfiltrations?: PdfExfiltration[];
  lng?: string;
  graphImage?: string;
  visualTimelineImage?: string;
  activityPlotImage?: string;
  chronologicalTreeData?: PdfTreeData;
}

export interface PdfTreeNode {
  id: string;
  x: number;
  y: number;
  label: string;
  status: string;
  isPatientZero: boolean;
}

export interface PdfTreeEdge {
  source: string;
  target: string;
  label: string;
  isTreeEdge: boolean;
}

export interface PdfTreeData {
  nodes: PdfTreeNode[];
  edges: PdfTreeEdge[];
  graphWidth: number;
  graphHeight: number;
}

const getEventLabel = (type: string, lng?: string) => i18n.t(`report.event_types.${type}`, { lng, defaultValue: type }) as string;
const getSystemTypeLabel = (type: string, lng?: string) => i18n.t(`report.system_types.${type}`, { lng, defaultValue: type }) as string;
const getPrivilegeLabel = (type: string, lng?: string) => i18n.t(`report.privileges.${type}`, { lng, defaultValue: type }) as string;


const M = 15;
const PW = 210;
const PH = 297;
const CW = PW - M * 2;

type Color = [number, number, number];

const SLATE_800: Color = [30, 41, 59];
const SLATE_400: Color = [148, 163, 184];
const GRAY_900: Color = [17, 24, 39];
const GRAY_700: Color = [55, 65, 81];
const GRAY_600: Color = [75, 85, 99];
const GRAY_500: Color = [107, 114, 128];
const GRAY_400: Color = [156, 163, 175];
const GRAY_300: Color = [209, 213, 219];
const WHITE: Color = [255, 255, 255];
const GREEN: Color = [21, 128, 61];
const RED_600: Color = [220, 38, 38];
const RED_50: Color = [254, 242, 242];
const ORANGE_600: Color = [234, 88, 12];
const ORANGE_50: Color = [255, 247, 237];
const BLUE_600: Color = [37, 99, 235];
const BLUE_50: Color = [239, 246, 255];
const AMBER_600: Color = [217, 119, 6];
const AMBER_50: Color = [255, 251, 235];
const GREEN_50: Color = [240, 253, 244];
const GREEN_700: Color = [21, 128, 61];
const SLATE_50: Color = [248, 250, 252];
const SLATE_200: Color = [226, 232, 240];

interface Ctx {
  pdf: jsPDF;
  y: number;
}

function lh(pts: number): number {
  return pts * 0.45;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > PH - M - 10) {
    ctx.pdf.addPage();
    ctx.y = M;
  }
}

function font(ctx: Ctx, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: Color = GRAY_900) {
  ctx.pdf.setFontSize(size);
  ctx.pdf.setFont('helvetica', style);
  ctx.pdf.setTextColor(...color);
}

function writeLines(ctx: Ctx, text: string, x: number, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: Color = GRAY_900, maxW = CW) {
  font(ctx, size, style, color);
  const lines: string[] = ctx.pdf.splitTextToSize(text, maxW);
  const h = lh(size);
  for (const line of lines) {
    ensureSpace(ctx, h);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += h;
  }
}

function htmlToText(html: string): string {
  if (!html) return '';
  let t = html;
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/p>/gi, '\n\n');
  t = t.replace(/<\/div>/gi, '\n');
  t = t.replace(/<\/li>/gi, '\n');
  t = t.replace(/<li[^>]*>/gi, '  \u2022 ');
  t = t.replace(/<\/h[1-6]>/gi, '\n\n');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/g, ' ');
  t = t.replace(/&amp;/g, '&');
  t = t.replace(/&lt;/g, '<');
  t = t.replace(/&gt;/g, '>');
  t = t.replace(/&quot;/g, '"');
  t = t.replace(/&#39;/g, "'");
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function writeHtmlContent(ctx: Ctx, html: string, x: number, maxW: number) {
  const plain = htmlToText(html);
  if (!plain) return;
  const paragraphs = plain.split('\n\n');
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;
    const subLines = para.split('\n');
    for (const sub of subLines) {
      if (!sub.trim()) continue;
      writeLines(ctx, sub.trim(), x, 9, 'normal', GRAY_700, maxW);
    }
    if (i < paragraphs.length - 1) ctx.y += 2;
  }
}

function drawSeparator(ctx: Ctx) {
  ctx.y += 3;
  ctx.pdf.setDrawColor(226, 232, 240);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(M, ctx.y, PW - M, ctx.y);
  ctx.y += 5;
}

function drawSectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 14);
  ctx.y += 3;
  font(ctx, 11, 'bold', GRAY_900);
  ctx.pdf.text(title, M, ctx.y);
  ctx.y += 2;
  ctx.pdf.setDrawColor(...GRAY_300);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(M, ctx.y, PW - M, ctx.y);
  ctx.y += 5;
}

function hexToRgb(hex: string): Color {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [128, 128, 128];
}

function drawBadge(ctx: Ctx, text: string, x: number, code: string, hexColor: string): number {
  font(ctx, 7, 'bold', WHITE);
  const textW = ctx.pdf.getTextWidth(text);
  const padX = 3;
  const badgeW = textW + padX * 2;
  const badgeH = 4.5;
  const badgeY = ctx.y - 3.2;
  const isWhite = code === 'WHITE' || code === 'CLEAR';

  if (isWhite) {
    ctx.pdf.setDrawColor(156, 163, 175);
    ctx.pdf.setLineWidth(0.3);
    ctx.pdf.roundedRect(x, badgeY, badgeW, badgeH, 1.5, 1.5, 'S');
    font(ctx, 7, 'bold', GRAY_700);
  } else {
    const rgb = hexToRgb(hexColor);
    ctx.pdf.setFillColor(0, 0, 0);
    ctx.pdf.roundedRect(x, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
    font(ctx, 7, 'bold', rgb);
  }
  ctx.pdf.text(text, x + padX, ctx.y);
  return badgeW;
}

function drawSmallBadge(ctx: Ctx, text: string, x: number, y: number, bg: Color, fg: Color, borderColor?: Color): number {
  font(ctx, 6.5, 'bold', fg);
  const tw = ctx.pdf.getTextWidth(text);
  const padX = 2.5;
  const bw = tw + padX * 2;
  const bh = 3.8;
  const by = y - 2.8;
  ctx.pdf.setFillColor(...bg);
  ctx.pdf.roundedRect(x, by, bw, bh, 1, 1, 'F');
  if (borderColor) {
    ctx.pdf.setDrawColor(...borderColor);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.roundedRect(x, by, bw, bh, 1, 1, 'S');
  }
  ctx.pdf.text(text, x + padX, y);
  return bw;
}

function fmtDate(d: string, lng?: string): string {
  return new Date(d).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(d: string, lng?: string): string {
  return new Date(d).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtShortDateTime(d: string, lng?: string): string {
  return new Date(d).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function computeDuration(start: string, end: string, lng?: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0 && hours === 0) return i18n.t('report.less_than_hour', { lng, defaultValue: "Moins d'une heure" }) as string;
  if (days === 0) return `${hours} ${i18n.t('report.hour', { lng, count: hours, defaultValue: 'heure' }) as string}${hours > 1 && lng !== 'en' ? 's' : ''}`;
  if (hours === 0) return `${days} ${i18n.t('report.day', { lng, count: days, defaultValue: 'jour' }) as string}${days > 1 && lng !== 'en' ? 's' : ''}`;
  return `${days} ${i18n.t('report.day', { lng, count: days, defaultValue: 'jour' }) as string}${days > 1 && lng !== 'en' ? 's' : ''} ${i18n.t('common.and', { lng, defaultValue: 'et' }) as string} ${hours} ${i18n.t('report.hour', { lng, count: hours, defaultValue: 'heure' }) as string}${hours > 1 && lng !== 'en' ? 's' : ''}`;
}

function drawHeadersAndFooters(
  pdf: jsPDF,
  caseNumber: string,
  reportTypeLabel: string,
  tlp?: { code: string; label: string; color: string },
  pap?: { code: string; label: string; color: string },
  lng?: string
) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);

    // Measure total width to center badges
    let totalBadgeW = 0;
    if (tlp) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      totalBadgeW += pdf.getTextWidth(tlp.label) + 6;
    }
    if (pap) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      totalBadgeW += pdf.getTextWidth(pap.label) + 6;
    }
    if (tlp && pap) totalBadgeW += 4;

    // Draw Headers
    const topCtx = { pdf, y: 7 };
    let topX = (PW - totalBadgeW) / 2;
    if (tlp) {
      topX += drawBadge(topCtx, tlp.label, topX, tlp.code, tlp.color);
      if (pap) topX += 4;
    }
    if (pap) {
      drawBadge(topCtx, pap.label, topX, pap.code, pap.color);
    }

    // Draw Footers
    const fy = PH - 6.5;
    const bottomCtx = { pdf, y: fy };

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY_400);
    pdf.text(`${reportTypeLabel} - ${caseNumber}`, M, fy);

    let botX = (PW - totalBadgeW) / 2;
    if (tlp && tlp.label) {
      botX += drawBadge(bottomCtx, tlp.label, botX, tlp.code, tlp.color);
      if (pap && pap.label) botX += 4;
    }
    if (pap && pap.label) {
      drawBadge(bottomCtx, pap.label, botX, pap.code, pap.color);
    }

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY_400);
    pdf.text(`${i18n.t('report.page', { lng, defaultValue: 'Page' })} ${i} / ${total}`, PW - M, fy, { align: 'right' });
  }
}

function drawSystemsSection(ctx: Ctx, systems: PdfSystem[], title: string, isAttacker: boolean, lng?: string) {
  if (!systems || systems.length === 0) return;

  drawSectionTitle(ctx, title);

  const rowH = 12;
  const indent = M + 4;
  const indentW = CW - 4;

  for (const sys of systems) {
    const metaParts: string[] = [];
    if (sys.owner) metaParts.push(`Proprietaire : ${sys.owner}`);
    if (Array.isArray(sys.ip_addresses) && sys.ip_addresses.length > 0) {
      const ips = sys.ip_addresses.map((ip: { ip: string }) => ip.ip).filter(Boolean).join(', ');
      if (ips) metaParts.push(ips);
    }

    // We compute the true needed height. 1 line of metapat = +4 height.
    const dynamicRowH = metaParts.length > 0 ? rowH + 4 : rowH;

    ensureSpace(ctx, dynamicRowH + 10);

    const typeLabel = getSystemTypeLabel(sys.system_type, lng);

    let bgColor: Color = SLATE_50;
    let statusLabel = '';
    let statusBg: Color = SLATE_50;
    let statusFg: Color = GRAY_500;

    if (!isAttacker) {
      if (sys.computedStatus === 'infected') {
        bgColor = RED_50;
        statusLabel = i18n.t('report.infected', { lng, defaultValue: 'Infecté' });
        statusBg = RED_50;
        statusFg = RED_600;
      } else if (sys.computedStatus === 'compromised') {
        bgColor = AMBER_50;
        statusLabel = i18n.t('report.compromised', { lng, defaultValue: 'Compromis' });
        statusBg = AMBER_50;
        statusFg = AMBER_600;
      } else if (sys.computedStatus === 'clean') {
        bgColor = GREEN_50;
        statusLabel = i18n.t('report.clean', { lng, defaultValue: 'Sain' });
        statusBg = GREEN_50;
        statusFg = GREEN_700;
      } else {
        statusLabel = i18n.t('report.unknown', { lng, defaultValue: 'Inconnu' });
      }
    }

    const boxY = ctx.y - 3;
    ctx.pdf.setFillColor(...bgColor);
    ctx.pdf.roundedRect(indent - 2, boxY, indentW + 2, dynamicRowH, 1.5, 1.5, 'F');
    ctx.pdf.setDrawColor(...SLATE_200);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.roundedRect(indent - 2, boxY, indentW + 2, dynamicRowH, 1.5, 1.5, 'S');

    font(ctx, 9, 'bold', GRAY_900);
    ctx.pdf.text(sys.name, indent + 2, ctx.y);
    let nameW = ctx.pdf.getTextWidth(sys.name);

    font(ctx, 7, 'normal', GRAY_500);
    ctx.pdf.text(typeLabel, indent + 2 + nameW + 3, ctx.y);
    let afterX = indent + 2 + nameW + 3 + ctx.pdf.getTextWidth(typeLabel) + 4;

    if (!isAttacker && statusLabel) {
      afterX += drawSmallBadge(ctx, statusLabel, afterX, ctx.y, statusBg, statusFg) + 3;
    }

    if (metaParts.length > 0) {
      ctx.y += 5;
      font(ctx, 7, 'normal', GRAY_500);
      ctx.pdf.text(metaParts.join('   '), indent + 2, ctx.y);
    }

    ctx.y += 8;
  }
  ctx.y += 6;
}

function drawCompromisedAccountsSection(ctx: Ctx, accounts: PdfCompromisedAccount[], lng?: string) {
  if (!accounts || accounts.length === 0) return;

  drawSectionTitle(ctx, i18n.t('report.compromised_accounts', { lng, defaultValue: 'Comptes compromis' }));

  const colWidths = [55, 35, 40, 40];
  const headers = [
    i18n.t('report.table.account', { lng, defaultValue: 'Compte' }),
    i18n.t('report.table.privileges', { lng, defaultValue: 'Privilèges' }),
    i18n.t('report.table.start', { lng, defaultValue: 'Première activité' }),
    i18n.t('report.table.end', { lng, defaultValue: 'Dernière activité' })
  ];
  const tableX = M;
  const rowH = 6;
  const headerH = 6;

  ensureSpace(ctx, headerH + 4);
  ctx.pdf.setFillColor(249, 250, 251);
  ctx.pdf.rect(tableX, ctx.y - 4, CW, headerH, 'F');
  ctx.pdf.setDrawColor(...GRAY_300);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(tableX, ctx.y - 4, CW, headerH, 'S');

  let cx = tableX + 2;
  for (let i = 0; i < headers.length; i++) {
    font(ctx, 7, 'bold', GRAY_600);
    ctx.pdf.text(headers[i], cx, ctx.y);
    cx += colWidths[i];
  }
  ctx.y += headerH - 1;

  for (let idx = 0; idx < accounts.length; idx++) {
    const a = accounts[idx];
    ensureSpace(ctx, rowH + 2);

    if (idx % 2 === 0) {
      ctx.pdf.setFillColor(255, 255, 255);
    } else {
      ctx.pdf.setFillColor(249, 250, 251);
    }
    ctx.pdf.rect(tableX, ctx.y - 3.5, CW, rowH, 'F');
    ctx.pdf.setDrawColor(243, 244, 246);
    ctx.pdf.setLineWidth(0.1);
    ctx.pdf.rect(tableX, ctx.y - 3.5, CW, rowH, 'S');

    cx = tableX + 2;
    const accountStr = a.domain ? `${a.domain}\\${a.account_name}` : a.account_name;
    font(ctx, 7.5, 'bold', GRAY_900);
    const accountParts = ctx.pdf.splitTextToSize(accountStr, colWidths[0] - 3);
    ctx.pdf.text(accountParts[0], cx, ctx.y);
    if (a.sid) {
      font(ctx, 6, 'normal', GRAY_400);
      ctx.pdf.text(a.sid.substring(0, 20), cx, ctx.y + 3);
    }

    cx += colWidths[0];
    font(ctx, 7.5, 'normal', GRAY_700);
    ctx.pdf.text(getPrivilegeLabel(a.privileges, lng), cx, ctx.y);

    cx += colWidths[1];
    font(ctx, 7.5, 'normal', GRAY_600);
    ctx.pdf.text(a.first_malicious_activity ? fmtShortDateTime(a.first_malicious_activity, lng) : 'N/A', cx, ctx.y);

    cx += colWidths[2];
    ctx.pdf.text(a.last_malicious_activity ? fmtShortDateTime(a.last_malicious_activity, lng) : 'N/A', cx, ctx.y);

    ctx.y += rowH;
  }
  ctx.y += 8;
}

function drawMalwareSection(ctx: Ctx, items: PdfMalware[], lng?: string) {
  if (!items || items.length === 0) return;

  drawSectionTitle(ctx, i18n.t('report.malware_tools', { lng, defaultValue: 'Malwares et outils' }));

  const colWidths = [65, 28, 40, 37];
  const headers = [
    i18n.t('report.table.file', { lng, defaultValue: 'Fichier' }),
    i18n.t('report.status', { lng, defaultValue: 'Statut' }),
    i18n.t('report.table.system', { lng, defaultValue: 'Système' }),
    i18n.t('report.table.date_creation', { lng, defaultValue: 'Date création' })
  ];
  const tableX = M;
  const rowH = 6;
  const headerH = 6;

  ensureSpace(ctx, headerH + 4);
  ctx.pdf.setFillColor(249, 250, 251);
  ctx.pdf.rect(tableX, ctx.y - 4, CW, headerH, 'F');
  ctx.pdf.setDrawColor(...GRAY_300);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(tableX, ctx.y - 4, CW, headerH, 'S');

  let cx = tableX + 2;
  for (let i = 0; i < headers.length; i++) {
    font(ctx, 7, 'bold', GRAY_600);
    ctx.pdf.text(headers[i], cx, ctx.y);
    cx += colWidths[i];
  }
  ctx.y += headerH - 1;

  for (let idx = 0; idx < items.length; idx++) {
    const m = items[idx];
    ensureSpace(ctx, rowH + 2);

    if (idx % 2 === 0) {
      ctx.pdf.setFillColor(255, 255, 255);
    } else {
      ctx.pdf.setFillColor(249, 250, 251);
    }
    ctx.pdf.rect(tableX, ctx.y - 3.5, CW, rowH, 'F');
    ctx.pdf.setDrawColor(243, 244, 246);
    ctx.pdf.setLineWidth(0.1);
    ctx.pdf.rect(tableX, ctx.y - 3.5, CW, rowH, 'S');

    cx = tableX + 2;
    font(ctx, 7.5, 'bold', GRAY_900);
    const nameParts = ctx.pdf.splitTextToSize(m.file_name, colWidths[0] - 3);
    ctx.pdf.text(nameParts[0], cx, ctx.y);
    if (m.file_path) {
      font(ctx, 6, 'normal', GRAY_400);
      const pathParts = ctx.pdf.splitTextToSize(m.file_path, colWidths[0] - 3);
      ctx.pdf.text(pathParts[0], cx, ctx.y + 3);
    }

    cx += colWidths[0];
    if (m.is_malicious === true) {
      font(ctx, 7.5, 'bold', RED_600);
      ctx.pdf.text(i18n.t('report.malicious', { lng, defaultValue: 'Malveillant' }), cx, ctx.y);
    } else if (m.is_malicious === false) {
      font(ctx, 7.5, 'normal', GRAY_500);
      ctx.pdf.text(i18n.t('report.tool_legitimate', { lng, defaultValue: 'Outil / Légitime' }), cx, ctx.y);
    } else {
      font(ctx, 7.5, 'normal', AMBER_600);
      ctx.pdf.text(i18n.t('report.unknown', { lng, defaultValue: 'Inconnu' }), cx, ctx.y);
    }

    cx += colWidths[1];
    font(ctx, 7.5, 'normal', GRAY_600);
    ctx.pdf.text(m.system_name || 'N/A', cx, ctx.y);

    cx += colWidths[2];
    ctx.pdf.text(m.creation_date ? fmtShortDateTime(m.creation_date, lng) : 'N/A', cx, ctx.y);

    ctx.y += rowH;
  }
  ctx.y += 8;
}

function drawNetworkIndicatorsSection(ctx: Ctx, indicators: PdfNetworkIndicator[], lng?: string) {
  if (!indicators || indicators.length === 0) return;

  drawSectionTitle(ctx, i18n.t('report.network_indicators', { lng, defaultValue: 'Indicateurs réseau' }));

  const colWidths = [50, 18, 32, 35, 35];
  const headers = [
    i18n.t('report.table.indicator', { lng, defaultValue: 'Indicateur' }),
    i18n.t('report.table.port', { lng, defaultValue: 'Port' }),
    i18n.t('report.table.associated_malware', { lng, defaultValue: 'Malware associé' }),
    i18n.t('report.table.start', { lng, defaultValue: 'Première activité' }),
    i18n.t('report.table.end', { lng, defaultValue: 'Dernière activité' })
  ];
  const tableX = M;
  const rowH = 6;
  const headerH = 6;

  ensureSpace(ctx, headerH + 4);
  ctx.pdf.setFillColor(249, 250, 251);
  ctx.pdf.rect(tableX, ctx.y - 4, CW, headerH, 'F');
  ctx.pdf.setDrawColor(...GRAY_300);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(tableX, ctx.y - 4, CW, headerH, 'S');

  let cx = tableX + 2;
  for (let i = 0; i < headers.length; i++) {
    font(ctx, 7, 'bold', GRAY_600);
    ctx.pdf.text(headers[i], cx, ctx.y);
    cx += colWidths[i];
  }
  ctx.y += headerH - 1;

  for (let idx = 0; idx < indicators.length; idx++) {
    const ind = indicators[idx];
    ensureSpace(ctx, rowH + 4);

    if (idx % 2 === 0) {
      ctx.pdf.setFillColor(255, 255, 255);
    } else {
      ctx.pdf.setFillColor(249, 250, 251);
    }
    ctx.pdf.rect(tableX, ctx.y - 3.5, CW, rowH + 2, 'F');
    ctx.pdf.setDrawColor(243, 244, 246);
    ctx.pdf.setLineWidth(0.1);
    ctx.pdf.rect(tableX, ctx.y - 3.5, CW, rowH + 2, 'S');

    cx = tableX + 2;
    font(ctx, 7.5, 'bold', GRAY_900);
    const indicator = ind.ip || ind.domain_name || ind.url || 'N/A';
    const indParts = ctx.pdf.splitTextToSize(indicator, colWidths[0] - 3);
    ctx.pdf.text(indParts[0], cx, ctx.y);
    if (ind.url && (ind.ip || ind.domain_name)) {
      font(ctx, 6, 'normal', GRAY_400);
      const urlParts = ctx.pdf.splitTextToSize(ind.url, colWidths[0] - 3);
      ctx.pdf.text(urlParts[0], cx, ctx.y + 3);
    }

    cx += colWidths[0];
    font(ctx, 7.5, 'normal', GRAY_600);
    ctx.pdf.text(ind.port !== null && ind.port !== undefined ? String(ind.port) : 'N/A', cx, ctx.y);

    cx += colWidths[1];
    ctx.pdf.text(ind.malware_file_name || 'N/A', cx, ctx.y);

    cx += colWidths[2];
    ctx.pdf.text(ind.first_activity ? fmtShortDateTime(ind.first_activity) : 'N/A', cx, ctx.y);

    cx += colWidths[3];
    ctx.pdf.text(ind.last_activity ? fmtShortDateTime(ind.last_activity) : 'N/A', cx, ctx.y);

    ctx.y += rowH + 2;
  }
  ctx.y += 8;
}

function drawExfiltrationsSection(ctx: Ctx, exfiltrations: PdfExfiltration[], lng?: string) {
  if (!exfiltrations || exfiltrations.length === 0) return;

  drawSectionTitle(ctx, i18n.t('report.exfiltrations', { lng, defaultValue: 'Exfiltrations' }));

  const indent = M + 4;
  const indentW = CW - 4;

  for (const e of exfiltrations) {
    const meta: string[] = [];
    if (e.source_system_name) meta.push(`${i18n.t('report.table.source', { lng, defaultValue: 'Source' })} : ${e.source_system_name}`);
    if (e.exfil_system_name) meta.push(`${i18n.t('report.table.via', { lng, defaultValue: 'Via' })} : ${e.exfil_system_name}`);
    if (e.destination_system_name) meta.push(`${i18n.t('report.table.destination', { lng, defaultValue: 'Destination' })} : ${e.destination_system_name}`);

    let descParts: string[] = [];
    if (e.content_description) {
      const plain = htmlToText(e.content_description);
      if (plain) {
        font(ctx, 7.5, 'italic', GRAY_600);
        descParts = ctx.pdf.splitTextToSize(plain, indentW - 4);
      }
    }

    let boxH = 6;
    if (meta.length > 0) boxH += 4;
    if (descParts.length > 0) boxH += descParts.length * 4;
    boxH = Math.max(18, boxH + 3);

    ensureSpace(ctx, boxH + 10);

    const boxY = ctx.y - 3;

    ctx.pdf.setFillColor(...ORANGE_50);
    ctx.pdf.roundedRect(indent - 2, boxY, indentW + 2, boxH, 1.5, 1.5, 'F');
    ctx.pdf.setDrawColor(253, 186, 116);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.roundedRect(indent - 2, boxY, indentW + 2, boxH, 1.5, 1.5, 'S');

    font(ctx, 8, 'bold', GRAY_900);
    const dateStr = e.exfiltration_date ? fmtDateTime(e.exfiltration_date, lng) : i18n.t('report.date_unknown', { lng, defaultValue: 'Date inconnue' });
    ctx.pdf.text(dateStr, indent + 2, ctx.y);

    if (e.file_name) {
      const dateW = ctx.pdf.getTextWidth(dateStr);
      font(ctx, 7.5, 'normal', GRAY_600);
      const sizeStr = e.file_size !== null && e.file_size !== undefined
        ? `  —  ${e.file_name} (${e.file_size} ${e.file_size_unit || ''})`
        : `  —  ${e.file_name}`;
      const sizeParts = ctx.pdf.splitTextToSize(sizeStr, indentW - dateW - 4);
      ctx.pdf.text(sizeParts[0], indent + 2 + dateW, ctx.y);
    }

    ctx.y += 4.5;

    if (meta.length > 0) {
      font(ctx, 7.5, 'normal', GRAY_600);
      ctx.pdf.text(meta.join('   '), indent + 2, ctx.y);
      ctx.y += 4;
    }

    if (descParts.length > 0) {
      font(ctx, 7.5, 'italic', GRAY_600);
      for (const part of descParts) {
        ctx.pdf.text(part, indent + 2, ctx.y);
        ctx.y += 4;
      }
    }

    ctx.y = boxY + boxH + 6;
  }
  ctx.y += 8;
}

function drawChronologicalTree(ctx: Ctx, tree: PdfTreeData, t: (key: string, opts?: any) => string, _lng?: string) {
  const { pdf } = ctx;
  pdf.addPage();
  ctx.y = M;
  drawSectionTitle(ctx, t('auto.arbre_lateralisation', { defaultValue: 'Arbre de latéralisation' }));

  // Scale the tree to fit the page width
  const nodeW = 50; // mm
  const nodeH = 14; // mm
  const pageArea = CW;
  const scale = Math.min(1, pageArea / (tree.graphWidth || 600) * 2.5);
  const offsetX = M + 10;
  const offsetY = ctx.y + 5;

  // Dark background
  const bgH = Math.min(PH - offsetY - M - 10, (tree.graphHeight || 300) * scale * 0.28 + 30);
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.roundedRect(M, offsetY - 5, CW, bgH, 3, 3, 'F');

  const nodeMap = new Map<string, PdfTreeNode>();
  tree.nodes.forEach(n => nodeMap.set(n.id, n));

  // Compute scaled positions
  const scaledNodes = tree.nodes.map(n => ({
    ...n,
    sx: offsetX + n.x * scale * 0.28,
    sy: offsetY + n.y * scale * 0.28,
  }));

  // Draw edges first (behind nodes)
  tree.edges.forEach(edge => {
    const src = scaledNodes.find(n => n.id === edge.source);
    const tgt = scaledNodes.find(n => n.id === edge.target);
    if (!src || !tgt) return;

    const x1 = src.sx + nodeW / 2;
    const y1 = src.sy + nodeH;
    const x2 = tgt.sx + nodeW / 2;
    const y2 = tgt.sy;

    const color: Color = edge.isTreeEdge ? BLUE_600 : RED_600;
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.4);

    // Draw a simple line (jsPDF doesn't have bezier, use polyline)
    const midY = (y1 + y2) / 2;
    pdf.line(x1, y1, x1, midY);
    pdf.line(x1, midY, x2, midY);
    pdf.line(x2, midY, x2, y2);

    // Arrow head
    const ah = 1.5;
    pdf.setFillColor(...color);
    pdf.triangle(x2, y2, x2 - ah, y2 - ah * 1.5, x2 + ah, y2 - ah * 1.5, 'F');

    // Edge label
    if (edge.label) {
      const labelText = edge.label.split('\n')[0];
      font(ctx, 6, 'normal', [96, 165, 250]); // blue-400
      const tw = pdf.getTextWidth(labelText);
      const lx = (x1 + x2) / 2;
      const ly = midY;

      // Label background
      pdf.setFillColor(30, 41, 59); // slate-800
      pdf.roundedRect(lx - tw / 2 - 2, ly - 2.5, tw + 4, 4.5, 1, 1, 'F');

      pdf.text(labelText, lx - tw / 2, ly + 0.5);
    }
  });

  // Status colors for badges
  const statusColors: Record<string, { bg: Color; label: string }> = {
    infected: { bg: [239, 68, 68], label: 'infecté' },
    compromised: { bg: [245, 158, 11], label: 'compromis' },
    clean: { bg: [16, 185, 129], label: 'sain' },
    unknown: { bg: [100, 116, 139], label: 'inconnu' },
  };

  // Draw nodes
  scaledNodes.forEach(n => {
    const x = n.sx;
    const y = n.sy;

    // Patient zéro label
    if (n.isPatientZero) {
      font(ctx, 5.5, 'normal', GRAY_400);
      const pzText = 'Patient zéro';
      const pzW = pdf.getTextWidth(pzText);
      const pzX = x + nodeW / 2 - pzW / 2;
      pdf.setFillColor(30, 41, 59);
      pdf.roundedRect(pzX - 2, y - 5, pzW + 4, 4, 1, 1, 'F');
      pdf.setDrawColor(71, 85, 105);
      pdf.setLineWidth(0.15);
      pdf.roundedRect(pzX - 2, y - 5, pzW + 4, 4, 1, 1, 'S');
      pdf.text(pzText, pzX, y - 2);
    }

    // Node background
    pdf.setFillColor(30, 41, 59); // slate-800
    pdf.roundedRect(x, y, nodeW, nodeH, 2, 2, 'F');
    pdf.setDrawColor(71, 85, 105); // slate-600
    pdf.setLineWidth(0.2);
    pdf.roundedRect(x, y, nodeW, nodeH, 2, 2, 'S');

    // Icon placeholder (small square)
    pdf.setFillColor(51, 65, 85); // slate-700
    pdf.roundedRect(x + 2.5, y + 2.5, 9, 9, 1.5, 1.5, 'F');
    // Simple monitor icon
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.25);
    pdf.rect(x + 4.5, y + 4, 5, 3.5, 'S');
    pdf.line(x + 5.5, y + 8.5, x + 8.5, y + 8.5);

    // Node name
    font(ctx, 8, 'bold', WHITE);
    const truncName = n.label.length > 12 ? n.label.substring(0, 11) + '…' : n.label;
    pdf.text(truncName, x + 13, y + 6);

    // Status badge
    const status = statusColors[n.status] || statusColors.unknown;
    font(ctx, 5.5, 'bold', WHITE);
    const badgeText = status.label;
    const badgeTW = pdf.getTextWidth(badgeText);
    pdf.setFillColor(...status.bg);
    pdf.roundedRect(x + 13, y + 8, badgeTW + 4, 4, 1, 1, 'F');
    pdf.text(badgeText, x + 15, y + 11);
  });

  ctx.y = offsetY + bgH + 5;
}

export function generateCaseReportPdf(input: PdfReportInput): void {
  const {
    caseData, tasks, taskEventsMap, firstEvent, lastEvent,
    reportType, periodLabel, taskActivityMap, historicalStatusMap, attackerUtcOffset,
    attackerSystems, compromisedSystems, compromisedAccounts, malwareTools, networkIndicators, exfiltrations,
    lng = i18n.language, // Default to current interface language if not specified
    graphImage,
    visualTimelineImage,
    activityPlotImage,
    chronologicalTreeData
  } = input;

  const t = (key: string, opts?: any) => i18n.t(key, { lng, ...opts }) as string;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const ctx: Ctx = { pdf, y: 0 };
  const isClosed = caseData.status === 'closed';
  const isPeriod = reportType !== 'full';

  const reportTypeLabel = reportType === 'full'
    ? t('report.confidential')
    : reportType === 'daily'
      ? t('report.daily_report')
      : t('report.weekly_report');

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  const titleLines: string[] = pdf.splitTextToSize(caseData.title, CW);
  const titleBlockH = titleLines.length * lh(16);
  const headerH = 12 + titleBlockH + 10;

  pdf.setFillColor(...SLATE_800);
  pdf.rect(0, 0, PW, headerH, 'F');

  ctx.y = 11;
  font(ctx, 9, 'normal', SLATE_400);
  pdf.text(caseData.case_number, M, ctx.y);
  const cnW = pdf.getTextWidth(caseData.case_number);
  font(ctx, 7, 'bold', isClosed ? GRAY_400 : GREEN);
  pdf.text(isClosed ? t('report.closed') : t('report.open'), M + cnW + 4, ctx.y);

  ctx.y += 6;
  font(ctx, 16, 'bold', WHITE);
  for (const line of titleLines) {
    pdf.text(line, M, ctx.y);
    ctx.y += lh(16);
  }
  ctx.y += 1;
  font(ctx, 7, 'normal', SLATE_400);
  if (isPeriod && periodLabel) {
    const subtitle = reportType === 'daily'
      ? t('report.daily_period', { period: periodLabel })
      : t('report.weekly_period', { period: periodLabel });
    pdf.text(subtitle, M, ctx.y);
  } else {
    pdf.text(t('report.generated_on', { date: fmtDate(new Date().toISOString(), lng) }), M, ctx.y);
  }

  // Draw logo in top right
  try {
    pdf.addImage(logoUrl, 'PNG', PW - M - 25, 6, 25, 25);
  } catch (e) {
    console.error('Error adding logo to PDF:', e);
  }

  ctx.y = headerH + 6;

  const col2 = PW / 2 + 5;
  const metaLabelW = 35; // Increased to fit "Attacker Timezone"

  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.author'), M, ctx.y);
  font(ctx, 9, 'bold', GRAY_900);
  pdf.text(caseData.author.full_name, M + metaLabelW, ctx.y);
  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.creation'), col2, ctx.y);
  font(ctx, 9, 'bold', GRAY_900);
  pdf.text(fmtDate(caseData.created_at, lng), col2 + metaLabelW, ctx.y);
  ctx.y += 5;

  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.severity'), M, ctx.y);
  font(ctx, 9, 'bold', GRAY_900);
  pdf.text(caseData.severity.label, M + metaLabelW, ctx.y);
  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.status'), col2, ctx.y);
  font(ctx, 9, 'bold', GRAY_900);
  pdf.text(isClosed ? t('report.closed_label_text', { defaultValue: 'Clôturé' }) : t('report.open_label_text', { defaultValue: 'Ouvert' }), col2 + metaLabelW, ctx.y);
  ctx.y += 5;

  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.tlp'), M, ctx.y);
  drawBadge(ctx, caseData.tlp.label, M + metaLabelW, caseData.tlp.code, caseData.tlp.color);
  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.pap'), col2, ctx.y);
  drawBadge(ctx, caseData.pap.label, col2 + metaLabelW, caseData.pap.code, caseData.pap.color);
  ctx.y += 5;

  font(ctx, 8, 'normal', GRAY_500);
  pdf.text(t('report.attacker_timezone'), M, ctx.y);
  const tzLabel = attackerUtcOffset !== null && attackerUtcOffset !== undefined
    ? attackerUtcOffset >= 0 ? `UTC+${attackerUtcOffset}` : `UTC${attackerUtcOffset}`
    : t('report.unknown');
  font(ctx, 9, 'bold', attackerUtcOffset !== null && attackerUtcOffset !== undefined ? GRAY_900 : GRAY_400);
  pdf.text(tzLabel, M + metaLabelW, ctx.y);
  ctx.y += 5;

  if (isClosed) {
    font(ctx, 8, 'normal', GRAY_500);
    pdf.text(t('report.closed_at_label'), M, ctx.y);
    font(ctx, 9, 'bold', GRAY_900);
    pdf.text(caseData.closed_at ? fmtDate(caseData.closed_at, lng) : t('report.na'), M + metaLabelW, ctx.y);
    font(ctx, 8, 'normal', GRAY_500);
    pdf.text(t('report.closed_by_label'), col2, ctx.y);
    font(ctx, 9, 'bold', GRAY_900);
    pdf.text(caseData.closed_by_user?.full_name || t('report.na'), col2 + metaLabelW, ctx.y);
    ctx.y += 5;
  }

  drawSeparator(ctx);

  if (firstEvent || lastEvent) {
    drawSectionTitle(ctx, t('report.chronology_malicious_events', { defaultValue: 'Chronologie des événements malveillants' }));

    const cardW = (CW - 8) / 3;
    const cardH = 14;
    const cardY = ctx.y - 3;

    if (firstEvent) {
      ctx.pdf.setFillColor(...RED_50);
      ctx.pdf.roundedRect(M, cardY, cardW, cardH, 1.5, 1.5, 'F');
      ctx.pdf.setDrawColor(254, 202, 202);
      ctx.pdf.setLineWidth(0.2);
      ctx.pdf.roundedRect(M, cardY, cardW, cardH, 1.5, 1.5, 'S');
      font(ctx, 6.5, 'bold', RED_600);
      pdf.text(t('report.first_event', { defaultValue: 'PREMIER ÉVÉNEMENT' }).toUpperCase(), M + 2, ctx.y);
      ctx.y += 4;
      font(ctx, 8, 'bold', GRAY_900);
      const fe = ctx.pdf.splitTextToSize(fmtDateTime(firstEvent, lng), cardW - 4);
      pdf.text(fe[0], M + 2, ctx.y);
    }

    const card2X = M + cardW + 4;
    ctx.y = cardY + 4;
    if (lastEvent) {
      ctx.pdf.setFillColor(...ORANGE_50);
      ctx.pdf.roundedRect(card2X, cardY, cardW, cardH, 1.5, 1.5, 'F');
      ctx.pdf.setDrawColor(253, 186, 116);
      ctx.pdf.setLineWidth(0.2);
      ctx.pdf.roundedRect(card2X, cardY, cardW, cardH, 1.5, 1.5, 'S');
      font(ctx, 6.5, 'bold', ORANGE_600);
      pdf.text(t('report.last_event', { defaultValue: 'DERNIER ÉVÉNEMENT' }).toUpperCase(), card2X + 2, ctx.y);
      ctx.y += 4;
      font(ctx, 8, 'bold', GRAY_900);
      const le = ctx.pdf.splitTextToSize(fmtDateTime(lastEvent, lng), cardW - 4);
      pdf.text(le[0], card2X + 2, ctx.y);
    }

    if (firstEvent && lastEvent) {
      const card3X = M + (cardW + 4) * 2;
      ctx.y = cardY + 4;
      ctx.pdf.setFillColor(...BLUE_50);
      ctx.pdf.roundedRect(card3X, cardY, cardW, cardH, 1.5, 1.5, 'F');
      ctx.pdf.setDrawColor(191, 219, 254);
      ctx.pdf.setLineWidth(0.2);
      ctx.pdf.roundedRect(card3X, cardY, cardW, cardH, 1.5, 1.5, 'S');
      font(ctx, 6.5, 'bold', BLUE_600);
      pdf.text(t('report.duration', { defaultValue: 'DURÉE' }).toUpperCase(), card3X + 2, ctx.y);
      ctx.y += 4;
      font(ctx, 8, 'bold', GRAY_900);
      pdf.text(computeDuration(firstEvent, lastEvent, lng), card3X + 2, ctx.y);
    }

    ctx.y = cardY + cardH + 5;
    drawSeparator(ctx);
  }

  drawSectionTitle(ctx, t('report.summary'));
  writeHtmlContent(ctx, caseData.description, M, CW);
  drawSeparator(ctx);

  if (isClosed && caseData.closure_summary) {
    drawSectionTitle(ctx, t('report.closure_summary', { defaultValue: 'Synthèse de clôture' }));
    ctx.pdf.setFillColor(249, 250, 251);
    const closureStartY = ctx.y - 3;
    writeHtmlContent(ctx, caseData.closure_summary, M + 4, CW - 8);
    ctx.pdf.setFillColor(249, 250, 251);
    ctx.pdf.roundedRect(M, closureStartY, CW, ctx.y - closureStartY + 4, 1.5, 1.5, 'F');
    ctx.pdf.setDrawColor(229, 231, 235);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.roundedRect(M, closureStartY, CW, ctx.y - closureStartY + 4, 1.5, 1.5, 'S');
    ctx.y = closureStartY + 4;
    writeHtmlContent(ctx, caseData.closure_summary, M + 4, CW - 8);
    ctx.y += 3;
    if (caseData.closed_at) {
      font(ctx, 7, 'normal', GRAY_500);
      let info = t('report.closed_on_by', {
        date: fmtDate(caseData.closed_at, lng),
        user: caseData.closed_by_user?.full_name || t('report.unknown')
      });
      pdf.text(info, M + 4, ctx.y);
      ctx.y += 4;
    }
    ctx.y += 3;
    drawSeparator(ctx);
  }

  const getTaskStatus = (t: PdfTask) => historicalStatusMap ? (historicalStatusMap[t.id] || t.status) : t.status;
  const openCount = tasks.filter(t => getTaskStatus(t) === 'open').length;
  const closedCount = tasks.filter(t => getTaskStatus(t) === 'closed').length;
  drawSectionTitle(ctx, t('report.tasks_counts', {
    open: openCount,
    closed: closedCount,
    s_open: openCount !== 1 ? 's' : '',
    s_closed: closedCount !== 1 ? 's' : ''
  }));

  if (tasks.length === 0) {
    font(ctx, 9, 'italic', GRAY_400);
    pdf.text(isPeriod ? t('report.no_tasks_period') : t('report.no_tasks'), M, ctx.y);
    ctx.y += 5;
  } else {
    const taskX = M + 8;
    const taskW = CW - 8;

    tasks.forEach((task, i) => {
      const taskStatus = getTaskStatus(task);
      const isTaskClosed = taskStatus === 'closed';

      // Minimum space to start a task box
      ensureSpace(ctx, 35);
      const boxStartY = ctx.y - 4;

      const bgColor: Color = isTaskClosed ? SLATE_50 : GREEN_50;
      const borderColor: Color = isTaskClosed ? SLATE_200 : [187, 247, 208]; // Light green border
      const statusColor: Color = isTaskClosed ? GRAY_600 : GREEN;

      // Draw background and top border for the task header
      ctx.pdf.setFillColor(...bgColor);
      ctx.pdf.setDrawColor(...borderColor);
      ctx.pdf.setLineWidth(0.2);
      ctx.pdf.roundedRect(M, boxStartY, CW, 14, 1.5, 1.5, 'F');
      ctx.pdf.roundedRect(M, boxStartY, CW, 14, 1.5, 1.5, 'S');

      ctx.y += 4;
      font(ctx, 9, 'bold', statusColor);
      pdf.text(`${i + 1}.`, M + 3, ctx.y);

      font(ctx, 10, 'bold', GRAY_900);
      const titleParts: string[] = pdf.splitTextToSize(task.title, taskW - 35);
      pdf.text(titleParts[0], taskX, ctx.y);

      const tw = pdf.getTextWidth(titleParts[0]);
      font(ctx, 7, 'bold', statusColor);
      const statusStr = isTaskClosed ? t('report.closed_label') : t('report.open_label');
      pdf.text(statusStr, taskX + tw + 3, ctx.y);

      let afterStatusX = taskX + tw + 3 + pdf.getTextWidth(statusStr) + 3;

      if (isTaskClosed && task.result) {
        font(ctx, 7, 'bold', BLUE_600);
        pdf.text(task.result.label, afterStatusX, ctx.y);
        afterStatusX += pdf.getTextWidth(task.result.label) + 3;
      }

      if (isPeriod && taskActivityMap && !isTaskClosed && taskActivityMap[task.id] !== undefined) {
        const hasActivity = taskActivityMap[task.id];
        font(ctx, 7, 'bold', hasActivity ? BLUE_600 : AMBER_600);
        pdf.text(hasActivity ? t('report.in_progress_label') : t('report.no_progress_label'), afterStatusX, ctx.y);
      }

      ctx.y += lh(10);
      if (titleParts.length > 1) {
        for (let j = 1; j < titleParts.length; j++) {
          font(ctx, 10, 'bold', GRAY_900);
          pdf.text(titleParts[j], taskX, ctx.y);
          ctx.y += lh(10);
        }
      }

      font(ctx, 7, 'italic', GRAY_500);
      let meta = `${t('report.created_on')} ${fmtDate(task.created_at, lng)}`;
      if (task.assigned_to_user) meta += ` - ${t('report.assigned_to')} ${task.assigned_to_user.full_name}`;
      pdf.text(meta, taskX, ctx.y);
      ctx.y += 6;

      // Draw a vertical line for the task content to show it belongs together
      const lineX = M + 4;
      const contentStartY = ctx.y - 2;

      if (task.description) {
        writeHtmlContent(ctx, task.description, taskX, taskW);
        ctx.y += 4;
      }

      const events = taskEventsMap[task.id] || [];
      if (events.length > 0) {
        ensureSpace(ctx, 15);
        const highlightsStartY = ctx.y - 3;

        ctx.pdf.setFillColor(255, 255, 255); // White bg for highlights
        ctx.pdf.setDrawColor(...GRAY_300);
        ctx.pdf.setLineWidth(0.15);

        font(ctx, 8, 'bold', GRAY_600);
        pdf.text(`${t('report.highlights', { defaultValue: 'Faits marquants' })} (${events.length})`, taskX + 2, ctx.y);
        ctx.y += 5;

        for (const ev of events) {
          ensureSpace(ctx, 6);
          const datePart = fmtShortDateTime(ev.event_datetime, lng);
          const typePart = ev.kill_chain ? t(`killChain.${ev.kill_chain}`) : getEventLabel(ev.event_type || '', lng);
          let sysPart = ev.source_system?.name || '?';
          if (ev.target_system) {
            const arrow = ev.direction === 'target_to_source' ? ' <- ' : ' -> ';
            sysPart += `${arrow}${ev.target_system.name}`;
          }
          const line = `${datePart}  |  ${typePart}  |  ${sysPart}`;

          font(ctx, 7, 'normal', GRAY_700);
          const evLines: string[] = pdf.splitTextToSize(line, taskW - 8);
          for (const el of evLines) {
            ensureSpace(ctx, 4);
            pdf.text(el, taskX + 4, ctx.y);
            ctx.y += 4;
          }
        }

        ctx.pdf.roundedRect(taskX, highlightsStartY - 1, taskW, ctx.y - highlightsStartY + 1, 1, 1, 'S');
        ctx.y += 5;
      }

      if (isTaskClosed && task.result && task.closure_comment) {
        ensureSpace(ctx, 12);
        font(ctx, 7, 'bold', GRAY_600);
        pdf.text(`${t('report.closure_comment', { defaultValue: 'Commentaire de fermeture' })} :`, taskX, ctx.y);
        ctx.y += 4;
        writeHtmlContent(ctx, task.closure_comment, taskX, taskW);
        if (task.closed_at) {
          ctx.y += 2;
          font(ctx, 7, 'italic', GRAY_400);
          let cInfo = t('report.closed_on_by', {
            date: fmtDate(task.closed_at, lng),
            user: task.closed_by_user?.full_name || t('report.unknown')
          });
          pdf.text(cInfo, taskX, ctx.y);
          ctx.y += 4;
        }
      }

      // Border on the left for the whole task content
      ctx.pdf.setDrawColor(...borderColor);
      ctx.pdf.setLineWidth(0.5);
      ctx.pdf.line(lineX, contentStartY, lineX, ctx.y - 4);

      ctx.y += 4;
      if (i < tasks.length - 1) {
        ctx.y += 2;
        pdf.setDrawColor(243, 244, 246);
        pdf.setLineWidth(0.2);
        pdf.line(M, ctx.y, PW - M, ctx.y);
        ctx.y += 6;
      }
    });
  }

  ctx.y += 4;
  drawSeparator(ctx);

  drawSystemsSection(ctx, attackerSystems || [], t('report.attacker_systems', { defaultValue: "Systèmes utilisés par l'attaquant" }), true, lng);
  drawSystemsSection(ctx, compromisedSystems || [], t('report.compromised_systems', { defaultValue: 'Systèmes compromis' }), false, lng);
  drawCompromisedAccountsSection(ctx, compromisedAccounts || [], lng);
  drawMalwareSection(ctx, malwareTools || [], lng);
  drawNetworkIndicatorsSection(ctx, networkIndicators || [], lng);
  drawExfiltrationsSection(ctx, exfiltrations || [], lng);

  if (graphImage) {
    pdf.addPage();
    ctx.y = M;
    drawSectionTitle(ctx, t('auto.mouvements_lateraux', { defaultValue: 'Mouvements latéraux' }));

    try {
      const imgProps = pdf.getImageProperties(graphImage);
      const imgRatio = imgProps.height / imgProps.width;

      const imgWidth = CW;
      const imgHeight = imgWidth * imgRatio;

      ensureSpace(ctx, imgHeight + 10);

      pdf.addImage(graphImage, 'JPEG', M, ctx.y, imgWidth, imgHeight);
      ctx.y += imgHeight + 10;
    } catch (e) {
      console.error('Failed to add graph image to PDF:', e);
    }
  }

  if (chronologicalTreeData && chronologicalTreeData.nodes.length > 0) {
    drawChronologicalTree(ctx, chronologicalTreeData, t, lng);
  }

  if (visualTimelineImage) {
    pdf.addPage();
    ctx.y = M;
    drawSectionTitle(ctx, t('auto.visual_timeline_export', { defaultValue: 'Timeline Visuelle' }));

    try {
      const imgProps = pdf.getImageProperties(visualTimelineImage);
      const imgRatio = imgProps.height / imgProps.width;
      const imgWidth = CW - 10;
      const totalImgHeight = imgWidth * imgRatio;

      let remainingHeight = totalImgHeight;
      let yOffset = 0;
      let renderHeight = 0;

      const pageContentHeight = PH - M - 28;

      while (remainingHeight > 0) {
        if (yOffset > 0) {
          pdf.addPage();
          ctx.y = M;
        }

        renderHeight = Math.min(remainingHeight, pageContentHeight);

        pdf.addImage(visualTimelineImage, 'JPEG', M + 5, ctx.y - yOffset, imgWidth, totalImgHeight);

        remainingHeight -= pageContentHeight;
        yOffset += pageContentHeight;
      }
      ctx.y = M + renderHeight + 10;
    } catch (e) {
      console.error('Failed to add timeline image to PDF:', e);
    }
  }

  if (activityPlotImage) {
    pdf.addPage();
    ctx.y = M;
    drawSectionTitle(ctx, t('auto.activity_plots_export', { defaultValue: "Graphiques d'activité" }));

    try {
      const imgProps = pdf.getImageProperties(activityPlotImage);
      const imgRatio = imgProps.height / imgProps.width;

      let imgWidth = CW;
      let imgHeight = imgWidth * imgRatio;

      const maxHeight = PH - M - 30;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight / imgRatio;
      }

      pdf.addImage(activityPlotImage, 'JPEG', M + (CW - imgWidth) / 2, ctx.y, imgWidth, imgHeight);
    } catch (e) {
      console.error('Failed to add activity plot image to PDF:', e);
    }
  }

  drawHeadersAndFooters(pdf, caseData.case_number, reportTypeLabel, caseData.tlp, caseData.pap, lng);

  const typePrefix = reportType === 'daily' ? 'quotidien' : reportType === 'weekly' ? 'hebdo' : 'rapport';
  const filename = `${typePrefix}_${caseData.case_number || 'case'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
