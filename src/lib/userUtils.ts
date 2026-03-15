export function getUserTrigram(fullName: string | undefined | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) {
    const name = parts[0];
    return name.length >= 2
      ? (name[0] + name[name.length - 1]).toUpperCase()
      : name[0]?.toUpperCase() || '?';
  }
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return (firstName[0] + lastName[0] + lastName[lastName.length - 1]).toUpperCase();
}
