module.exports = {
  botName: process.env.BOT_NAME || 'Elaina',
  ownerNumber: process.env.OWNER_NUMBER || '',
  port: Number(process.env.PORT || 3000),
  // Set DASHBOARD_TOKEN as an environment variable in production.
  dashboardToken: process.env.DASHBOARD_TOKEN || ''
};
