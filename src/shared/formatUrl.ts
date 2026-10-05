export function formatLocalImageUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return "local-image://local-file/" + encodeURIComponent(normalized);
}
