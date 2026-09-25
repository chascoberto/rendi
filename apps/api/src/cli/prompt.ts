import { createInterface } from 'node:readline'

export function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    }),
  )
}

/** Pide un texto sin mostrarlo en pantalla (contraseñas). */
export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const output = rl as unknown as { _writeToOutput: (s: string) => void }
    let muted = false
    output._writeToOutput = (s: string) => {
      if (!muted || s.includes('\n')) process.stdout.write(muted ? '\n' : s)
    }
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
    muted = true
  })
}
