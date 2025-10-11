import express from 'express';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const app = express();
const PORT = process.env.PORT || 10000;

// --- Парсеры тела для CloudPayments ---
app.use(express.json({ type: ['application/json', 'text/plain'], limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- Telegram ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- Прокси для пересылки на ludik.club ---
const proxyAuth = 'user315490:wj74b1';
const proxyHost = '193.201.10.104';
const proxyPort = 4404;
const proxyAgent = new HttpsProxyAgent(`http://${proxyAuth}@${proxyHost}:${proxyPort}`);

// --- Forward настройки ---
const FORWARD_URL = 'https://ludik.club/api/payment/webhook';

// --- Webhook ---
app.post('/webhook', async (req, res) => {
  const data = req.body;

  if (!data || !data.TransactionId) {
    console.log('Пропущен вебхук: неуспешный или другой тип операции');
    return res.status(200).send('OK');
  }

  // --- Составляем объект с нужными полями ---
  const forwardData = {
    TransactionId: data.TransactionId,
    Amount: data.Amount,
    Currency: data.Currency,
    PaymentAmount: data.PaymentAmount,
    PaymentCurrency: data.PaymentCurrency,
    DateTime: data.DateTime,
    Status: data.Status,
    OperationType: data.OperationType,
    InvoiceId: data.InvoiceId,
    Description: data.Description,
    TokenRecipient: data.TokenRecipient,
    PaymentMethod: data.PaymentMethod,
  };

  console.log('Webhook received:', forwardData);

  // --- Фильтруем только успешные и отклонённые платежи ---
  if (
    (forwardData.OperationType === 'Payment' && (forwardData.Status === 'Completed' || forwardData.Status === 'Authorized')) ||
    forwardData.OperationType === 'Fail'
  ) {
    // 1️⃣ Telegram
    try {
      const message = `
💳 Платеж
ID: ${forwardData.TransactionId}
Сумма: ${forwardData.Amount} ${forwardData.Currency}
Статус: ${forwardData.Status}
Тип: ${forwardData.OperationType}
InvoiceId: ${forwardData.InvoiceId}
Описание: ${forwardData.Description || '—'}
      `;

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
      });

      console.log('✅ Отправлено в Telegram');
    } catch (err) {
      console.error('❌ Ошибка отправки в Telegram:', err.message);
    }

    // 2️⃣ Пересылка на ludik.club через прокси
    try {
      const response = await axios.post(FORWARD_URL, forwardData, {
        httpsAgent: proxyAgent,
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('✅ Запрос переслан на ludik.club через прокси:', response.status);
    } catch (error) {
      console.error('❌ Ошибка пересылки на ludik.club через прокси:', error.message);
    }
  } else {
    console.log('Пропущен вебхук: неуспешный или другой тип операции');
  }

  // Ответ CloudPayments
  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`Webhook server running on port ${PORT}`));
