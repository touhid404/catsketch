// Schema operations require session continuity; Neon pools application transactions.
export function migrationDatabaseUrl(value) {
  const url = new URL(value);
  if (url.hostname.endsWith('.neon.tech')) {
    url.hostname = url.hostname.replace('-pooler.', '.');
  }
  return url.toString();
}
