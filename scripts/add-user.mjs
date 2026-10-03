// Provision ONE studio account (Supabase Auth + its profile row).
//
// Separate from seed-users.mjs, which hardcodes the three demo accounts and
// their shared password: this is for adding a real person later.
//
// The password is NEVER hardcoded, defaulted or printed: the script ASKS for it
// in the terminal, hidden and twice (scripts/password-prompt.mjs), so it stays
// with whoever runs this and lands in no repo, shell history or log.
// NEW_USER_PASSWORD still works for a run without a terminal.
//
// Run:
//   npm run user:add -- --email someone@example.com --name "Their Name"
//
// Idempotent, and deliberately NON-destructive: if the account already exists
// it does NOT reset the password (silently changing someone's credentials is
// worse than doing nothing) — it only makes sure the profile is right.
import { createClient } from '@supabase/supabase-js'
import { APP_URL } from '../src/lib/brand.js'
import { askNewPassword } from './password-prompt.mjs'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local)')
  process.exit(1)
}

// --email a@b.c --name "Full Name" [--role equipment_team]
function arg(flag) {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : null
}
const email = (arg('--email') || '').trim().toLowerCase()
// One flat role today — see src/lib/permissions.js. The column's check
// constraint was dropped in 20260724140000_flat_role.sql, so a new role name
// needs no migration.
const role = (arg('--role') || 'equipment_team').trim()
// Falls back to the email's local part, exactly like the fn_handle_new_user
// trigger does, so the two paths agree.
const fullName = (arg('--name') || '').trim() || email.split('@')[0]

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: node --env-file=.env.local scripts/add-user.mjs --email a@b.c --name "Full Name"')
  process.exit(1)
}

// Supabase's own floor is 6; this is a nudge, not the policy — the project's
// password rules are checked by Supabase on top of it.
const MIN_LENGTH = 12

// NEW_USER_PASSWORD still works for a run without a terminal, but by default the
// password is ASKED for, hidden and twice: a variable typed into a shell is
// saved in that shell's history file.
async function newPassword(label) {
  const fromEnv = process.env.NEW_USER_PASSWORD
  if (fromEnv) {
    if (fromEnv.length < MIN_LENGTH)
      throw new Error(`NEW_USER_PASSWORD is ${fromEnv.length} characters — use at least ${MIN_LENGTH}.`)
    return fromEnv
  }
  return askNewPassword(label, MIN_LENGTH)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function findUserByEmail(target) {
  // The admin API has no get-by-email, so page through. 200/page covers a
  // studio roster many times over; the loop is here so it stays correct anyway.
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
  let user = await findUserByEmail(email)
  let created = false

  if (user) {
    console.log(`exists   ${email} — password left untouched (to change it: npm run user:password -- --email ${email})`)
  } else {
    const password = await newPassword(`${fullName} <${email}>`)
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      // No mail is sent by this app, so an unconfirmed account could never
      // sign in. The studio issues accounts directly (self-registration was
      // removed from the login screen on request).
      email_confirm: true,
      // The trigger reads only the name from here: a role in user metadata was
      // the signer's to choose, so since 20261003120000 it is ignored.
      user_metadata: { full_name: fullName },
    })
    if (error) throw new Error(`create ${email}: ${error.message}`)
    user = data.user
    created = true
    console.log(`created  ${email}`)
  }

  // The trigger already inserted a profile row — INACTIVE, so the account sees
  // nothing (20261003120000). This makes the name and role match what was asked
  // for, repairs a row from an earlier attempt, and switches the account ON:
  // being issued by the studio is what activation means. Only the service role
  // can write `active`; no policy lets an account touch its own profile.
  const { error: pErr } = await db
    .from('profiles')
    .upsert({ id: user.id, full_name: fullName, role, email, active: true })
  if (pErr) throw new Error(`profile ${email}: ${pErr.message}`)

  console.log(`profile  ${fullName} · ${role} · active`)
  console.log(
    created
      ? `\nDone. They can sign in at ${APP_URL} with the password you set.`
      : '\nDone. Profile updated; to change their password: npm run user:password -- --email ' + email,
  )
}

main().catch((e) => {
  console.error('ADD USER FAILED:', e.message)
  process.exit(1)
})
