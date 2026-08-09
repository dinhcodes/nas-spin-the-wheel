// On GitHub Pages the site is served from /<repo>/, so the CI sets BASE_PATH.
// Locally BASE_PATH is unset, so dev/build stay at the root.
const basePath = process.env.BASE_PATH || ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath, // so raw <img> src can be prefixed at runtime
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
