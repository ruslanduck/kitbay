// How the account scripts get a password without it ever being shown, saved or
// passed on a command line. Three ways, tried in this order:
//
//   • --clipboard — read it from the clipboard, where a password manager puts
//     it. Nothing is typed, so nothing depends on how a terminal handles keys
//     (the in-app terminal panel once swallowed a hidden prompt's keystrokes,
//     which is why this exists), and a generated password can't be mistyped.
//     The clipboard is cleared afterwards.
//   • NEW_USER_PASSWORD — an environment variable, for a run with no terminal.
//     A variable typed into a shell lands in that shell's history file, so it is
//     not the default.
//   • otherwise ASKED for in the terminal, twice, each character shown as `*`.
//
// Character codes rather than escape sequences throughout, so this file holds no
// backslash that an editor or a tool could quietly turn into a control byte.
import { execFileSync } from 'node:child_process'

const ENTER = [10, 13]
const CTRL_C = 3
const ESC = 27
const BACKSPACE = [8, 127]
const ERASE = String.fromCharCode(8, 32, 8)

export function askHidden(question) {
  const { stdin, stdout } = process
  if (!stdin.isTTY)
    return Promise.reject(
      new Error('No interactive terminal to ask in — copy the password and add --clipboard instead.'),
    )
  return new Promise((resolve, reject) => {
    let value = ''
    // 0 = normal, 1 = just saw ESC, 2 = inside a CSI/SS3 sequence. An arrow key
    // or Home sends ESC [ A …: without this its "[A" would silently join a
    // password nobody can see.
    let escape = 0
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
        if (escape) {
          if (escape === 1 && (ch === '[' || ch === 'O')) escape = 2
          else if (code >= 64 && code <= 126) escape = 0
          continue
        }
        if (code === ESC) {
          escape = 1
          continue
        }
        if (ENTER.includes(code)) return finish()
        if (code === CTRL_C) return finish(new Error('Cancelled — nothing was changed.'))
        if (BACKSPACE.includes(code)) {
          if (value) {
            value = [...value].slice(0, -1).join('')
            stdout.write(ERASE)
          }
          continue
        }
        if (code < 32) continue
        value += ch
        // A star per character: typing that shows NOTHING reads as a terminal
        // that isn't taking input. The length is all it gives away.
        stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

// The clipboard as text, exactly — PowerShell is told to write UTF-8 and add no
// line break of its own (Windows PowerShell 5.1 would otherwise use the console's
// code page and mangle anything outside ASCII).
function readClipboard() {
  if (process.platform === 'win32')
    return execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', '[Console]::OutputEncoding = [Text.Encoding]::UTF8; [Console]::Out.Write((Get-Clipboard -Raw))'],
      { encoding: 'utf8' },
    )
  if (process.platform === 'darwin') return execFileSync('pbpaste', { encoding: 'utf8' })
  throw new Error('--clipboard is set up for Windows and macOS only — leave it off and type the password.')
}

function clearClipboard() {
  try {
    if (process.platform === 'win32') execFileSync('cmd.exe', ['/d', '/c', 'type nul | clip'])
    else if (process.platform === 'darwin') execFileSync('pbcopy', { input: '' })
    return true
  } catch {
    return false
  }
}

// What the clipboard held → the password, or throws. One line break at the end
// is what copying a whole line adds; anything else that isn't the password is
// refused rather than quietly trimmed.
export function passwordFromClipboardText(raw, minLength) {
  const password = String(raw ?? '').replace(/(?:\r?\n)$/, '')
  if (!password) throw new Error('The clipboard is empty — copy the password first. Nothing was changed.')
  if (/[\r\n]/.test(password) || password.trim() !== password)
    throw new Error('The clipboard holds more than one line or spaces at the ends — copy just the password. Nothing was changed.')
  if (password.length < minLength)
    throw new Error(`The copied password is ${password.length} characters — use at least ${minLength}. Nothing was changed.`)
  return password
}

// Returns the password, or throws with the reason (and changes nothing).
export async function getNewPassword(label, minLength) {
  if (process.argv.includes('--clipboard')) {
    const password = passwordFromClipboardText(readClipboard(), minLength)
    console.log(`Using the password from the clipboard (${password.length} characters).`)
    const cleared = clearClipboard()
    console.log(cleared ? 'Clipboard cleared.' : 'Could not clear the clipboard — clear it yourself.')
    return password
  }
  const fromEnv = process.env.NEW_USER_PASSWORD
  if (fromEnv) {
    if (fromEnv.length < minLength)
      throw new Error(`NEW_USER_PASSWORD is ${fromEnv.length} characters — use at least ${minLength}.`)
    return fromEnv
  }
  // Asked twice: a typo nobody can see is only found when the person can't
  // sign in.
  const first = await askHidden(`New password for ${label}: `)
  if (first.length < minLength)
    throw new Error(`That is ${first.length} characters — use at least ${minLength}. Nothing was changed.`)
  const again = await askHidden('Type it again: ')
  if (again !== first) throw new Error('The two entries differ. Nothing was changed.')
  return first
}
