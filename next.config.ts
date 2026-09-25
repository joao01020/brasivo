import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/mandato/:id",
        destination: "/mandate/:id",
        permanent: true,
      },
      {
        source: "/parlamentar/:id",
        destination: "/mandate/:id",
        permanent: true,
      },
      {
        source: "/estado/:uf",
        destination: "/state/:uf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
