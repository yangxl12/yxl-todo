/** Copies text to the clipboard; false means the browser refused and the
 *  caller should offer a fallback (select the text by hand). */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
