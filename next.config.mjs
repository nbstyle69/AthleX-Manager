/** @type {import('next').NextConfig} */
const nextConfig = {
  // `forbidden()` : un refus d'autorisation rend un vrai 403 avant tout rendu.
  // Sans ce drapeau, la seule issue serait un 404 (indistinguable d'une route
  // absente) ou une redirection — donc un signal non discriminant.
  experimental: { authInterrupts: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lkwdlqlbrbxaiydkoxfp.supabase.co' },
    ],
  },
};

export default nextConfig;
