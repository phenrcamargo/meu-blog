// Formata a data como "2026.08.18", no estilo de timestamp de terminal.
export function formatDateToTerminalTimestamp(date: Date): String {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}