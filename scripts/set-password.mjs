// Give an EXISTING account a new password — to replace one that leaked, or to
// hand a person a proper password of their own.
//
// The password is never an argument and never printed, so nothing of it reaches
// the shell's history, a log, the repo or a chat. Copy it from a password
// manager and add --clipboard (nothing to type, the clipboard is cleared after),
// or leave that off and type it twice when asked, each character shown as `*`
// (scripts/password-prompt.mjs). add-user.mjs deliberately never touches an
// existing account's password; this is the explicit way to do it.
//
// Run:  npm run user:password -- --email someone@example.com --clipboard
//   (=  node --env-file=.env.local scripts/set-password.mjs --email someone@example.com --clipboard)
import { createClient } from '@supabase/supabase-js'
import { getNewPassword } from './password-prompt.mjs'
import { APP_URL } from '../src/lib/brand.js'

// A floor, not the policy: the project's own password rules (Authentication →
// Sign In / Providers → Email) are checked by Supabase on top of this, and its
// refusal is printed as it comes.
const MIN_LENGTH = 12

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local)')
  process.exit(1)
}

const i = process.argv.indexOf('--email')
const email = (i > -1 ? process.argv[i + 1] || '' : '').trim().toLowerCase()
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run user:password -- --email someone@example.com')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  const user = await findUserByEmail(email)
  if (!user) {
    console.error(`No account with ${email}. To create one: npm run user:add -- --email ${email} --name "Their Name"`)
    process.exit(1)
  }
  const { data: profile } = await db.from('profiles').select('full_name, active').eq('id', user.id).maybeSingle()
  const who = profile?.full_name ? `${profile.full_name} <${email}>` : email
  console.log(`Account: ${who}${profile && profile.active === false ? ' — NOT ACTIVE (it still cannot see any data)' : ''}`)

  const password = await getNewPassword(who, MIN_LENGTH)
  const { error } = await db.auth.admin.updateUserById(user.id, { password })
  if (error) throw new Error(`Supabase refused it: ${error.message}`)

  console.log(`\nDone — the password for ${email} is changed.`)
  console.log(`Hand it over through a password manager, not a messenger. Sign-in: ${APP_URL}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
