const TELEGRAM_API_BASE = "https://api.telegram.org";

function normalizePhoneDigits(phone) {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return "7" + digits.slice(1);
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return "7" + digits;
  }
  return null;
}

function formatPhoneDisplay(intl) {
  return `+${intl[0]} ${intl.slice(1, 4)} ${intl.slice(4, 7)}-${intl.slice(7, 9)}-${intl.slice(9, 11)}`;
}

module.exports = async function submitLead(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Разрешён только метод POST" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "Некорректный формат данных" });
    }
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const consent = body?.consent === true;
  const source = typeof body?.source === "string" ? body.source.trim() : "";
  const page = typeof body?.page === "string" ? body.page.trim() : "";

  if (!phone) {
    return res.status(400).json({ ok: false, error: "Укажите номер телефона" });
  }
  const normalizedPhone = normalizePhoneDigits(phone);
  if (!normalizedPhone) {
    return res.status(400).json({
      ok: false,
      error: "Проверьте номер телефона — похоже, не хватает цифр или есть лишние символы",
    });
  }
  if (!consent) {
    return res.status(400).json({
      ok: false,
      error: "Необходимо согласие на обработку персональных данных",
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Не настроены переменные окружения Telegram");
    return res.status(500).json({
      ok: false,
      error: "Сервис отправки заявок временно недоступен",
    });
  }

  const submittedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Saratov",
  }).format(new Date());
  const message = [
    `Имя: ${name || "не указано"}`,
    `Телефон: ${formatPhoneDisplay(normalizedPhone)}`,
    `Страница: ${page || "не указана"}`,
    `Источник: ${source || "не определён"}`,
    `Время заявки: ${submittedAt}`,
  ].join("\n");

  try {
    const telegramResponse = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      },
    );

    if (!telegramResponse.ok) {
      console.error("Telegram API вернул ошибку", telegramResponse.status);
      return res.status(502).json({
        ok: false,
        error: "Не удалось отправить заявку. Попробуйте ещё раз",
      });
    }
  } catch (error) {
    console.error("Ошибка обращения к Telegram API", error);
    return res.status(502).json({
      ok: false,
      error: "Не удалось отправить заявку. Попробуйте ещё раз",
    });
  }

  return res.status(200).json({ ok: true });
};
