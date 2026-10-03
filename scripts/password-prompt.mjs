// Ask for a password in the terminal WITHOUT showing it. Nothing is echoed, so it
// never lands on screen, in a screenshot, in the shell's history or in a log — a
// variable typed into a shell (`$env:NEW_USER_PASSWORD = '…'`) lands in that
// shell's history file, which is why the scripts ask instead.
//
// Raw mode, read character by character: Enter finishes, Backspace deletes,
// Ctrl+C cancels, and a paste from a password manager arrives as one chunk and
// works. Character codes rather than escape sequences, so this file holds no
// backslash that an editor or a tool could quietly turn into a control byte.
const ENTER = [10, 13]
const CTRL_C = 3
const BACKSPACE = [8, 127]

export function askHidden(question) {
  const { stdin, stdout } = process
  if (!stdin.isTTY)
    return Promise.reject(
      new Error('No interactive terminal to ask in — run this in a terminal, not through a pipe.'),
    )
  return new Promise((resolve, reject) => {
    let value = ''
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    const finish = (error) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      console.log()
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0)
        if (ENTER.includes(code)) return finish()
        if (code === CTRL_C) return finish(new Error('Cancelled — nothing was changed.'))
        if (BACKSPACE.includes(code)) {
          value = value.slice(0, -1)
          continue
        }
        if (code < 32) continue
        value += ch
      }
    }
    stdin.on('data', onData)
  })
}

// Asked twice, because a typo in a hidden field is invisible until the person
// can't sign in. Returns the password, or throws with the reason.
export async function askNewPassword(label, minLength) {
  const first = await askHidden(`New password for ${label}: `)
  if (first.length < minLength)
    throw new Error(`That is ${first.length} characters — use at least ${minLength}. Nothing was changed.`)
  const again = await askHidden('Type it again: ')
  if (again !== first) throw new Error('The two entries differ. Nothing was changed.')
  return first
}
