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
    {
      name: 'bookmarks',
      script: 'packages/bookmarks/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'win-switcher',
      script: 'packages/win-switcher/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'notifications',
      script: 'packages/notifications/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'notes',
      script: 'packages/notes/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'banner-watcher',
      script: 'swift',
      args: 'packages/notifications/src/native/banner-watcher.swift --url http://localhost:3004',
      interpreter: 'none',
      autorestart: true,
      watch: false,
    },
  ],
}
