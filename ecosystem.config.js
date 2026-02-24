module.exports = {
  apps: [
    {
      name: 'portal',
      script: 'packages/portal/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'cc-monitor',
      script: 'packages/cc-monitor/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
  ],
}
