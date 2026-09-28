/** @type {import('next').NextConfig} */
const nextConfig = {
  // `forbidden()` : un refus d'autorisation rend un vrai 403 avant tout rendu.
  // Sans ce drapeau, la seule issue serait un 404 (indistinguable d'une route
  // absente) ou une redirection — donc un signal non discriminant.
  experimental: { authInterrupts: true },
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
