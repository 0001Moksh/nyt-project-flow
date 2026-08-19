/**
 * Normalize project description text for admin/student UI display.
 * Enrollment historically stored field labels like "**Project Description**: ...".
 */
export function stripDescriptionLabelPrefix(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/^\s*(?:\*\*)?\s*project\s*description\s*(?:\*\*)?\s*:\s*/i, '')
    .replace(/(?:^|\n)\s*\*\*\s*project\s*description\s*\*\*\s*:\s*/gi, '\n')
    .trim();
}

export function cleanProjectDescription(raw?: string | null): string {
  if (!raw) return '';

  let text = stripDescriptionLabelPrefix(raw);

  // Light markdown cleanup for table cells
  text = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
