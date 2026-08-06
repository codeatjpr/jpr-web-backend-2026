/**
 * PM2 process file for jpr-backend.
 * Must be .cjs because package.json has "type": "module".
 *
 * Always starts in production. Usage:
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'jpr-backend',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
}
