/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lkwdlqlbrbxaiydkoxfp.supabase.co' },
    ],
  },
};

export default nextConfig;
