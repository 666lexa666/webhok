import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
app.use(bodyParser.json());

// ------------------- Настройки ------------------- //
const TELEGRAM_TOKEN = '7527450434:AAGT8a04U7WV09BbayPcrG_Z9qNIjXO92Xc';
const TELEGRAM_CHAT_ID = '-1002834907441';

const FORWARD_URL = 'https://ludik.club/your-endpoint';
const FORWARD_USERNAME = 'username';
const FORWARD_PASSWORD = 'password';
// ------------------------------------------------- //

app.post('/webhook', async (req, res) => {
  const data = req.body;

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
    PaymentMethod: data.PaymentMethod
  };

  console.log('Webhook received:', forwardData);

  // Отправка только успешных и отклонённых платежей
  if (forwardData.OperationType === 'Payment' && (forwardData.Status === 'Completed' || forwardData.Status === 'Authorized') ||
      forwardData.OperationType === 'Fail') {
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
        text: message
      });

      console.log('✅ Отправлено в Telegram');
    } catch (err) {
      console.error('❌ Ошибка отправки в Telegram:', err.message);
    }

    // 2️⃣ Пересылка на ludik.club
    try {
      await axios.post(FORWARD_URL, forwardData, {
        auth: { username: FORWARD_USERNAME, password: FORWARD_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('✅ Запрос переслан на ludik.club');
    } catch (error) {
      console.error('❌ Ошибка пересылки на ludik.club:', error.response?.data || error.message);
    }
  } else {
    console.log('Пропущен вебхук: неуспешный или другой тип операции');
  }

  // Ответ CloudPayments
  res.json({ code: 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook server running on port ${PORT}`));
