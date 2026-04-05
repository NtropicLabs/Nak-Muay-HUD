/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // MediaPipe tasks-vision ships WASM; no custom webpack rules needed for V1.
};

export default nextConfig;
