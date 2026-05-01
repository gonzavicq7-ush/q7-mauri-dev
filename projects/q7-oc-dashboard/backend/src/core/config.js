import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3001),
  openclawApiUrl: process.env.OPENCLAW_API_URL || 'http://localhost:8080',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  notifMinIntervalSec: Number(process.env.NOTIF_MIN_INTERVAL_SEC || 60),
  notifStallMinutes: Number(process.env.NOTIF_STALL_MINUTES || 10),
  notifDailySummaryTime: process.env.NOTIF_DAILY_SUMMARY_TIME || '20:00',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'sqlite:///./q7oc.db',
  environment: process.env.ENVIRONMENT || 'development'
};
