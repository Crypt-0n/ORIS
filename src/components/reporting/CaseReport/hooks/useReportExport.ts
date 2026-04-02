import { useState } from 'react';
import { api } from '../../../../lib/api';
import { ReportType } from '../types';

export function useReportExport(
  caseId: string,
  reportType: ReportType,
  selectedDate: string,
  weekCount: 1 | 2,
  language: string,
) {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const queryParams = new URLSearchParams({
        type: reportType,
        date: selectedDate,
        weeks: weekCount.toString(),
        lng: language
      });
      
      const blob = await api.download(`/reports/export/${caseId}?${queryParams.toString()}`);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeCaseId = caseId.replace(/[^a-zA-Z0-9-]/g, '_');
      link.download = `Incident_Report_${safeCaseId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export PDF via Puppeteer:', err);
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}
