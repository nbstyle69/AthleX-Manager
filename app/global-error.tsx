'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body style={{ background: '#0A0A0A', color: 'white', fontFamily: 'monospace', padding: '2rem' }}>
        <h1 style={{ color: '#f87171' }}>Erreur JS client</h1>
        <pre style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '8px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {error?.message}
          {'\n\n'}
          {error?.stack}
        </pre>
        <p style={{ color: '#94a3b8' }}>Digest: {error?.digest}</p>
      </body>
    </html>
  );
}
