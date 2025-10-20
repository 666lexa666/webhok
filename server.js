import express from 'express';
import axios from 'axios';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 10000;

// --- Парсеры тела ---
app.use(express.json({ type: ['application/json', 'text/plain'], limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- Telegram ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- MongoDB ---
const MONGO_URI = process.env.MONGO_URI;

// Подключаемся к MongoDB
mongoose
  .connect(MONGO_URI, { dbName: 'test' })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Схема транзакции
const transactionSchema = new mongoose.Schema({
  operation_id: String, // ✅ храним как строку
  amount: Number,
  currency: String,
  description: String,
  status: String, // success | canceled | pending
  updatedAt: { type: Date, default: Date.now },
  dateUp: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('transactions', transactionSchema);

// --- Webhook ---
app.post('/webhook', async (req, res) => {
  console.log('🧠 Тело запроса:', JSON.stringify(req.body, null, 2));

  const data = req.body;

  if (!data || !data.TransactionId) {
    console.log('⚠️ Пропущен вебхук: нет TransactionId');
    return res.status(200).send('OK');
  }

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

  console.log('📩 Webhook received:', forwardData);

  const isSuccess =
    forwardData.OperationType === 'Payment' &&
    (forwardData.Status === 'Completed' || forwardData.Status === 'Authorized');
  const isFail = forwardData.OperationType === 'Fail' || forwardData.Status === 'Canceled';

  if (isSuccess || isFail) {
    // --- 1️⃣ Telegram ---
    try {
      const message = `
💳 Платёж
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

    // --- 2️⃣ Обновляем MongoDB ---
    try {
      const newStatus = isSuccess ? 'success' : 'canceled';

      const updated = await Transaction.findOneAndUpdate(
        { operation_id: String(forwardData.TransactionId) }, // ✅ приводим к строке
        {
          $set: {
            status: newStatus,
            amount: forwardData.Amount,
            currency: forwardData.Currency,
            description: forwardData.Description,
            updatedAt: new Date(),
            dateUp: new Date(),
          },
        },
        { new: true }
      );

      if (updated) {
        console.log(`✅ Обновлён статус транзакции ${updated.operation_id} → ${newStatus}`);
      } else {
        console.log(`⚠️ Транзакция ${forwardData.TransactionId} не найдена в базе`);
      }
    } catch (err) {
      console.error('❌ Ошибка обновления MongoDB:', err.message);
    }
  } else {
    console.log('ℹ️ Пропущен вебхук: неуспешная операция');
  }

  res.status(200).json({ code: 0 });
});

app.listen(PORT, () => console.log(`🚀 Webhook server running on port ${PORT}`));
