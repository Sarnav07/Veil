/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @veil/sdk is a workspace package shipped as TypeScript source; Next must
  // transpile it rather than treat it as pre-built node_modules JS.
  transpilePackages: ['@veil/sdk'],
  webpack: (config) => {
    // The SDK uses NodeNext-style ".js" extensions on its relative imports (so
    // tsc/tsx resolve them), but those files are actually ".ts". Teach webpack to
    // resolve a ".js" import to the corresponding ".ts" source.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
