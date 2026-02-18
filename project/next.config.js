const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^undici$/ })
    );

    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@firebase/auth-compat/dist/esm/index.node.esm.js': '@firebase/auth-compat/dist/esm/index.esm.js',
        '@firebase/auth/dist/node-esm/index.js': '@firebase/auth/dist/esm2017/index.js',
        undici: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;