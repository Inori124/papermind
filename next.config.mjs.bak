/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      // Redirect pdfjs-dist legacy paths to standard browser builds.
      // The legacy paths bypass package.json's "browser" field which maps
      // Node.js modules (canvas, fs, path) to false — the standard builds
      // respect this, avoiding the need for manual stubs.
      'pdfjs-dist/legacy/build/pdf': './node_modules/pdfjs-dist/build/pdf.js',
      'pdfjs-dist/legacy/web/pdf_viewer': './node_modules/pdfjs-dist/web/pdf_viewer.js',
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        canvas: false,
        'path2d-polyfill': false,
      };
    }
    return config;
  },
};

export default nextConfig;
