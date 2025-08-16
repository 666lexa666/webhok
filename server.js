const express = require('express')
const axios = require('axios')
require('dotenv').config() // Загружаем переменные из .env

const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyAgent = new HttpsProxyAgent('http://user315490:wj74b1@91.217.125.240:4404');

const app = express()
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID,
  FORWARD_URL,
  FORWARD_USERNAME,
  FORWARD_PASSWORD
} = process.env

app.post('/paymaster-webhook', async (req, res) => {
  console.log('📥 Заголовки:', req.headers)
  console.log('📥 Тело запроса:', req.body)
  const data = req.body

  

  console.log('📥 Получен запрос:', JSON.stringify(data, null, 2))

  if (!data || !data.LMI_PAYMENT_AMOUNT || !data.LMI_SYS_PAYMENT_DATE) {
    console.error('❌ Ошибка: некорректное тело запроса', data)
    return res.status(400).send('Некорректное тело запроса')
  }

  const amount = parseFloat(data.LMI_PAYMENT_AMOUNT)
  const paymentDate = new Date(data.LMI_SYS_PAYMENT_DATE).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
  const payer = data.LMI_PAYER_IDENTIFIER
  const desc = data.LMI_PAYMENT_DESC || 'Оплата'

  const message = `💳 Оплата получена\nСумма: ${amount} руб.\nДата: ${paymentDate}\nПлательщик: ${payer}`

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    })
    console.log('✅ Сообщение отправлено в Telegram')
  } catch (error) {
    console.error('❌ Ошибка отправки в Telegram:', error.response?.data || error.message)
  }

  try {
    await axios.post(FORWARD_URL, data, {
      auth: {
        username: FORWARD_USERNAME,
        password: FORWARD_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    })
    console.log('✅ Запрос переслан на ludik.club')
  } catch (error) {
    console.error('❌ Ошибка пересылки на ludik.club:', error.response?.data || error.message)
  }

  res.status(200).send('Уведомление обработано и перенаправлено')
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}/paymaster-webhook`)
})
