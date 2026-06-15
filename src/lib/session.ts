import { supabase } from './supabase'

export async function destroySession() {
  const token = localStorage.getItem('farmsy_session_token')
  if (token) {
    localStorage.removeItem('farmsy_session_token')
    fetch('/api/session/destroy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_token: token }),
    }).catch(() => {})
  }
  await supabase.auth.signOut()
}
