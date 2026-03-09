module.exports = {
  apps : [{
    name: 'snorkelology_master',
    script: './dist/prod/server/server.mjs',
    watch: false,
    restart_max_memory: '300M', 
    cron_restart: '12 */4 * * *',
    interpreter: 'node'
  },
  {
    name: 'snorkelology_beta',
    script: './dist/beta/server/server.mjs',
    watch: false,
    restart_max_memory: '300M', 
    cron_restart: '46 */4 * * *',
    interpreter: 'node'
  }]
};
