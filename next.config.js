/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'p5': 'p5',
      'tone': 'Tone',
    });
    return config;
  },
}

module.exports = nextConfig 