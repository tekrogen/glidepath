import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev-tools badge paints ABOVE sheet/dialog overlays and
  // occludes controls in design-QA captures (design QA DS-47-006); it has
  // no production counterpart, so nothing is lost by disabling it.
  devIndicators: false,
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
