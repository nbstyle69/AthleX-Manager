'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestLogin() {
  const [log, setLog] = useState<string[]>([]);
  const [email, setEmail] = useState('nabil.selmane@gmail.com');
  const [password, setPassword] = useState('');

  function addLog(msg: string) {
    setLog(prev => [...prev, msg]);
  }

  async function runTest() {
    setLog([]);
    addLog('1. Tentative de connexion client-side...');

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      addLog('❌ Erreur login: ' + error.message);
      return;
    }
    if (!data.session) {
      addLog('❌ Pas de session retournée');
      return;
    }

    addLog('✅ Session créée: ' + data.session.user.email);
    addLog('   Access token (début): ' + data.session.access_token.slice(0, 30) + '...');

    addLog('2. Vérification session côté serveur (/api/session)...');
    const res = await fetch('/api/session', { credentials: 'include' });
    const json = await res.json();

    addLog('🍪 Cookies reçus par le serveur: ' + JSON.stringify(json.receivedCookies ?? []));

    if (json.user) {
      addLog('✅ Serveur voit la session: ' + json.user.email);
      addLog('→ Navigation vers le dashboard...');
      window.location.href = '/';
    } else {
      addLog('❌ Serveur ne voit PAS la session');
      addLog('   Error: ' + (json.error ?? 'null'));
      addLog('');
      addLog('🔍 Cookies dans le navigateur (noms):');
      const browserCookieNames = document.cookie.split(';').map(c => c.trim().split('=')[0]).join(', ');
      addLog(browserCookieNames || '(aucun cookie visible)');
    }
  }

  return (
    <div style={{ background: '#0F0F1A', minHeight: '100vh', padding: '2rem', fontFamily: 'monospace', color: 'white' }}>
      <h1 style={{ color: '#818cf8' }}>Test Login Diagnostic</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', background: '#1a1a2e', border: '1px solid #333', color: 'white', flex: 1 }}
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Mot de passe"
          style={{ padding: '8px', borderRadius: '6px', background: '#1a1a2e', border: '1px solid #333', color: 'white', flex: 1 }}
        />
        <button
          onClick={runTest}
          style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
        >
          Tester
        </button>
      </div>
      <div style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '8px', minHeight: '200px' }}>
        {log.map((line, i) => (
          <div key={i} style={{ color: line.startsWith('❌') ? '#f87171' : line.startsWith('✅') ? '#4ade80' : '#94a3b8', marginBottom: '4px' }}>
            {line}
          </div>
        ))}
        {log.length === 0 && <span style={{ color: '#555' }}>Clique sur Tester...</span>}
      </div>
    </div>
  );
}
