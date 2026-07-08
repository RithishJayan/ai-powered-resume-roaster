/** @type {import('next').NextConfig} */
const path = require('node:path');

const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  experimental: {
    // Hoisted workspace deps live at repo root; standalone trace must include them (Docker/npm -w).
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  async rewrites() {
    return [
      { source: '/api/register', destination: `${backendBase}/api/register` },
      { source: '/api/roast', destination: `${backendBase}/api/roast` },
      { source: '/api/roast/feedback', destination: `${backendBase}/api/roast/feedback` },
    ];
  },
};

module.exports = nextConfig;
