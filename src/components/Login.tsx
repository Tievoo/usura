import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Magic link. El alta pública está desactivada en el proyecto, así que
 * `shouldCreateUser: false`: si el mail no fue invitado, no se crea la cuenta.
 */
export function Login() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle')
  const [error, setError] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEstado('enviando')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    if (error) {
      setEstado('error')
      setError(
        error.message.toLowerCase().includes('signups not allowed')
          ? 'Ese mail no está invitado. Pedile a Tievo que te dé acceso.'
          : error.message,
      )
      return
    }
    setEstado('enviado')
  }

  return (
    <div className="login">
      <div>
        <div className="marca"><span>Usura</span></div>
        <h1>Tus gastos</h1>
      </div>

      {estado === 'enviado' ? (
        <p className="msg">
          Te mandé un link a <b>{email}</b>. Abrilo desde este mismo dispositivo y listo.
        </p>
      ) : (
        <>
          <p>Entrás con un link al mail. No hay contraseña que recordar.</p>
          <form onSubmit={enviar}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@mail.com"
              autoComplete="email"
              inputMode="email"
              required
            />
            <button type="submit" disabled={estado === 'enviando' || !email.trim()}>
              {estado === 'enviando' ? 'Mandando…' : 'Mandame el link'}
            </button>
          </form>
          {estado === 'error' && <p className="msg error">{error}</p>}
        </>
      )}
    </div>
  )
}
