import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep the corner clear for the app's own UI during demos.
  devIndicators: false,
  // Lets phones and other laptops on the same network open the dev server by IP.
  // Covers every private network range, so it keeps working when the Wi-Fi changes.
  allowedDevOrigins: ['10.*.*.*', '172.*.*.*', '192.168.*.*', '*.local'],
};

export default nextConfig;
