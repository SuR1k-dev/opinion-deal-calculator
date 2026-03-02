import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // @ts-ignore
    allowedDevOrigins: ["localhost", "127.0.0.1", "http://localhost", "http://127.0.0.1", "http://localhost:3000", "http://localhost:3001", "192.168.56.1"],
};

export default nextConfig;
