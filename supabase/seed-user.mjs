// Usage : node supabase/seed-user.mjs email@exemple.fr motdepasse
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Charge .env.local sans dépendance externe
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2]
}

const [email, password] = process.argv.slice(2)
if (!email || !password) { console.error('Usage: node supabase/seed-user.mjs <email> <motdepasse>'); process.exit(1) }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (error) { console.error('Erreur :', error.message); process.exit(1) }
console.log('Compte créé :', data.user.email)
