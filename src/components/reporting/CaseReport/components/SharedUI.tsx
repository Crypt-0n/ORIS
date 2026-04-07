export function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
    </div>
  );
}

export function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-medium text-gray-500 min-w-[120px]">{label}</span>
      <span className="text-sm font-medium" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

export function TlpPapBadge({ code, label, color }: { code: string; label: string; color: string }) {
  const isWhite = code === 'WHITE';
  return (
    <span
      className={`px-2.5 py-0.5 rounded text-xs font-semibold ${isWhite ? 'border border-gray-400' : ''}`}
      style={{ backgroundColor: isWhite ? 'transparent' : '#000000', color: isWhite ? '#374151' : color }}
    >
      {label}
    </span>
  );
}

export function formatDate(dateStr: string, lng: string) {
  return new Date(dateStr).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string, lng: string) {
  return new Date(dateStr).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTimeShort(dateStr: string, lng: string) {
  return new Date(dateStr).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function computeDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0 && hours === 0) return "Moins d'une heure";
  if (days === 0) return `${hours} heure${hours > 1 ? 's' : ''}`;
  if (hours === 0) return `${days} jour${days > 1 ? 's' : ''}`;
  return `${days} jour${days > 1 ? 's' : ''} et ${hours} heure${hours > 1 ? 's' : ''}`;
}
