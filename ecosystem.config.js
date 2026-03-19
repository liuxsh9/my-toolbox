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
      name: 'litellm-monitor',
      script: 'packages/litellm-monitor/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        PORTAL_URL: 'http://localhost:3000',
        LITELLM_URL: 'http://localhost:4000',
        LITELLM_KEY: 'sk-777d7f151fe65eb158c468b572d4cacef482c5c3063bae2f8ac56bff5843a3fb',
      },
    },
    {
      name: 'work-hours',
      script: 'packages/work-hours/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'api-quota',
      script: 'packages/api-quota/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3008,
        PORTAL_URL: 'http://localhost:3000',
      },
    },
    {
      name: 'todo',
      script: 'packages/todo/dist/server/index.js',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3009,
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
