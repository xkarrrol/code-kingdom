// Tylko zapis tekstu do schowka. Nie ma połączenia z edytorem ani silnikiem gry.
export async function copyReferenceText(text: string, clipboard?: Pick<Clipboard, 'writeText'>): Promise<string> {
  if (!clipboard) return 'Schowek jest niedostępny. Zaznacz tekst i skopiuj go ręcznie.'
  try {
    await clipboard.writeText(text)
    return 'Skopiowano do schowka.'
  } catch {
    return 'Nie udało się skopiować. Zaznacz tekst i skopiuj go ręcznie.'
  }
}
