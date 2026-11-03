import { runJSPIExperiment } from './client.ts'

const button = document.querySelector<HTMLButtonElement>('#run-test')!
const output = document.querySelector<HTMLPreElement>('#result')!
const log = (message: string) => {
  output.textContent += message + '\n'
  console.log('[JSPI experiment]', message)
}

button.addEventListener('click', async () => {
  button.disabled = true
  output.textContent = ''
  log(`Przeglądarka: ${navigator.userAgent}`)
  try {
    const result = await runJSPIExperiment(
      () => new Worker(new URL('./experiment.worker.ts', import.meta.url), { type: 'module' }), log,
    )
    if (result.status === 'unsupported') log(`NIEOBSŁUGIWANE: ${result.reason}`)
  } catch (error) {
    log(`BŁĄD: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    button.disabled = false
  }
})
