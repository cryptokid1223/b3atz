/** @type {import('next').NextConfig} */
const nextConfig = {
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