import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  sassOptions: {
    includePaths: [path.join(__dirname, 'src/styles')],
    prependData: `
      @use 'sass:color';
      @use 'helpers' as *;
    `,
  },
  // Disable React StrictMode in development to prevent WebSocket double connections
  reactStrictMode: false,
};

export default nextConfig;
