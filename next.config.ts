import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set by scripts/dev-lan.mjs. Next blocks cross-origin dev requests
  // (including the HMR websocket) from non-localhost origins; without this
  // allowance, pages served to phones via the LAN IP never hydrate (#14).
  ...(process.env.LAN_DEV_ORIGIN
    ? { allowedDevOrigins: [process.env.LAN_DEV_ORIGIN] }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
