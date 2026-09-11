/** @type {import('next').NextConfig} */
const nextConfig = {
  // `forbidden()` : un refus d'autorisation rend un vrai 403 avant tout rendu.
  // Sans ce drapeau, la seule issue serait un 404 (indistinguable d'une route
  // absente) ou une redirection — donc un signal non discriminant.
  experimental: { authInterrupts: true },
  // `pdf-parse` (pdfjs-dist) est chargé tel quel par Node au lieu d'être rebundlé par webpack :
  // le bundle fige `createRequire("file:///<chemin de build>/pdf.mjs")`, invalide au runtime
  // serverless, donc `@napi-rs/canvas` ne se charge pas et pdfjs plante à l'import
  // (`SCALE_MATRIX = new DOMMatrix()` → « DOMMatrix is not defined »).
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  // Chargements dynamiques invisibles au file tracing : `@napi-rs/canvas` (createRequire dans un
  // try/catch) et le worker `pdf.worker.mjs` (import() à l'exécution). On les embarque explicitement.
  outputFileTracingIncludes: {
    '/api/wods/import-pdf': [
      './node_modules/pdf-parse/dist/**',
      './node_modules/pdfjs-dist/legacy/build/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
    ],
  },
  // Les liens d'authentification construits sur `{{ .SiteURL }}` héritent du
  // chemin porté par ce réglage Supabase (`…/email-confirme`), d'où des URL
  // `/email-confirme/auth/confirm?token_hash=…` en 404. La vérification vit
  // sous `/auth/*` : on y renvoie, requête et paramètres intacts, pour que les
  // liens déjà envoyés restent utilisables.
  async redirects() {
    return [
      { source: '/email-confirme/auth/:path*', destination: '/auth/:path*', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lkwdlqlbrbxaiydkoxfp.supabase.co' },
    ],
  },
};

export default nextConfig;
