app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    const transactionId = String(body.TransactionId); // ✅ Приводим к строке

    console.log('📩 Webhook received:', body);

    // --- Ищем транзакцию по строковому operation_id ---
    const transaction = await Transaction.findOne({ operation_id: transactionId });

    if (!transaction) {
      console.log(`⚠️ Транзакция ${transactionId} не найдена в базе`);
      return res.status(200).send('OK');
    }

    // --- Обновляем статус ---
    transaction.status = body.Status || 'Unknown';
    transaction.dateUp = new Date();
    await transaction.save();

    console.log(`✅ Транзакция ${transactionId} обновлена: ${transaction.status}`);

    // --- Отправляем уведомление в Telegram ---
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const msg = `💰 Статус платежа обновлён\n\n🆔 ID: ${transactionId}\n📧 Email: ${transaction.customer_email || '—'}\n💳 Статус: ${transaction.status}`;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'HTML',
    });

    console.log('✅ Отправлено в Telegram');
    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Ошибка при обработке webhook:', err);
    res.status(500).send('Error');
  }
});
