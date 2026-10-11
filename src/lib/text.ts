/** Cut text back to its last complete sentence so a reader never sees half a thought. */
export function toLastSentence(text: string): string {
  const trimmed = text.trimEnd();
  if (/[.!?]$/.test(trimmed)) return trimmed;
  const end = Math.max(trimmed.lastIndexOf(". "), trimmed.lastIndexOf("! "), trimmed.lastIndexOf("? "));
  return end > 0 ? trimmed.slice(0, end + 1) : `${trimmed}...`;
}
