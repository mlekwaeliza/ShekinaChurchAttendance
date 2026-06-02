module.exports = {
  apps: [
    {
      name: 'church-attendance',
      script: 'server/server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 15000,
      shutdown_with_message: true,
      node_args: ['--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Tell PM2 that the app is ready when it logs "Server running on port".
      // This gates the graceful-shutdown timeout.
      ready_message: 'Server running on port'
    }
  ]
};
