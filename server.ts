import express from "express";
import path from "path";
import fs from "fs";
import dns from "dns";
import net from "net";
import { createServer as createViteServer } from "vite";

interface LogEntry {
  id: string;
  timestamp: string;
  source: "Yandex" | "Domru" | "System";
  message: string;
  type: "info" | "success" | "error";
}

interface AppDatabase {
  phone: string;
  accessToken: string;
  refreshToken: string;
  places: any[];
  domofons: any[];
  simulationMode: boolean;
}

const DB_FILE = path.join(process.cwd(), "database.json");
const PORT = parseInt(process.env.PORT || "3000", 10);

// Initialize local DB
function loadDB(): AppDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to read database.json:", e);
  }
  return {
    phone: "",
    accessToken: "",
    refreshToken: "",
    places: [],
    domofons: [],
    simulationMode: true, // Default to simulation if not logged in
  };
}

function saveDB(db: AppDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write database.json:", e);
  }
}

let db = loadDB();

// Global log storage
let apiLogs: LogEntry[] = [
  {
    id: "init",
    timestamp: new Date().toISOString(),
    source: "System",
    message: "Шлюз интеграции Дом.ру и Яндекс.Умного Дома успешно запущен.",
    type: "info",
  },
];

function addLog(source: "Yandex" | "Domru" | "System", message: string, type: "info" | "success" | "error" = "info") {
  const newLog: LogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    source,
    message,
    type,
  };
  apiLogs.unshift(newLog);
  if (apiLogs.length > 100) {
    apiLogs = apiLogs.slice(0, 100);
  }
}

function getFetchErrorMsg(err: any): string {
  let details = err.message;
  if (err.cause) {
    if (typeof err.cause === 'object') {
      details += ` (Причина: ${err.cause.message || err.cause.code || JSON.stringify(err.cause)})`;
    } else {
      details += ` (Причина: ${err.cause})`;
    }
  }
  return details;
}

// Simulated data helpers
const MOCK_PLACES = [
  {
    id: 112233,
    address: "г. Нижний Новгород, ул. Усилова, д. 3, кв. 42",
    city: "Нижний Новгород",
    street: "Усилова",
    house: "3",
    flat: "42",
  },
];

const MOCK_DOMOFONS = [
  {
    id: 4567,
    placeId: 112233,
    name: "Панель подъезда №1 (Усилова д.3)",
    hasCamera: true,
    cameraUrl: "mjpeg", // Special flag for demo image or fake stream
    status: "online",
  },
];

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- Front-end API ---

  // Check current session
  app.get("/api/session", (req, res) => {
    res.json({
      phone: db.phone,
      hasToken: !!db.accessToken,
      simulationMode: db.simulationMode,
    });
  });

  // Diagnostics check endpoint
  app.get("/api/diagnose", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      dns: {
        domain: "ss-api.domru.ru",
        resolvedIps: [] as string[],
        error: null as string | null,
      },
      tcp: {
        host: "ss-api.domru.ru",
        port: 443,
        connected: false,
        error: null as string | null,
        duration: 0,
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        serverLocationHint: "Google Cloud Run (США, us-east1)",
      }
    };

    addLog("System", "Запущен тест диагностики связи с серверами Дом.ру (ss-api.domru.ru)...", "info");

    // 1. DNS Resolution
    await new Promise<void>((resolve) => {
      dns.resolve4("ss-api.domru.ru", (dnsErr, addresses) => {
        if (dnsErr) {
          results.dns.error = `${dnsErr.message} (${dnsErr.code})`;
          addLog("System", `Диагностика: DNS ошибка: ${dnsErr.message}`, "error");
        } else {
          results.dns.resolvedIps = addresses;
          addLog("System", `Диагностика: DNS успешно разрешен: ${addresses.join(", ")}`, "success");
        }
        resolve();
      });
    });

    // 2. TCP Handshake
    const targetIp = results.dns.resolvedIps[0] || "ss-api.domru.ru";
    const startTime = Date.now();
    await new Promise<void>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(4000);

      socket.on("connect", () => {
        results.tcp.connected = true;
        results.tcp.duration = Date.now() - startTime;
        addLog("System", `Диагностика: Успешное TCP порт 443 за ${results.tcp.duration}мс!`, "success");
        socket.destroy();
        resolve();
      });

      socket.on("error", (err: any) => {
        results.tcp.error = `${err.message} (${err.code || "UNKNOWN"})`;
        addLog("System", `Диагностика: Ошибка подключения: ${err.message}`, "error");
        socket.destroy();
        resolve();
      });

      socket.on("timeout", () => {
        results.tcp.error = "TIMEOUT (4.0s). IP-адреса Google Cloud заблокированы файрволом Дом.ру (ЭР-Телеком).";
        addLog("System", "Диагностика: Превышено время ожидания. Сеть заблокирована файрволом Дом.ру из-за рубежа.", "error");
        socket.destroy();
        resolve();
      });

      socket.connect(443, targetIp);
    });

    res.json(results);
  });

  // Toggle simulation mode
  app.post("/api/session/toggle-simulation", (req, res) => {
    const { enabled } = req.body;
    db.simulationMode = !!enabled;
    saveDB(db);
    addLog("System", `Режим симуляции переключен: ${db.simulationMode ? "ВКЛ" : "ВЫКЛ"}`, "info");
    res.json({ success: true, simulationMode: db.simulationMode });
  });

  // Force Log out
  app.post("/api/session/logout", (req, res) => {
    db.phone = "";
    db.accessToken = "";
    db.refreshToken = "";
    db.places = [];
    db.domofons = [];
    saveDB(db);
    addLog("System", "Пользователь вышел из аккаунта (ключи авторизации удалены).", "info");
    res.json({ success: true });
  });

  // Request SMS verification code
  app.post("/api/auth/request-otp", async (req, res) => {
    let { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Номер телефона обязателен" });
    }

    // Standardize phone (remove non-digits, ensure starts with 7)
    phone = phone.replace(/\D/g, "");
    if (phone.startsWith("8")) {
      phone = "7" + phone.substring(1);
    }
    if (!phone.startsWith("7") && phone.length === 10) {
      phone = "7" + phone;
    }

    addLog("Domru", `Запрос кода подтверждения для номера +${phone}...`, "info");

    if (db.simulationMode) {
      setTimeout(() => {
        addLog("Domru", `[Симуляция] SMS-код успешно отправлен на номер +${phone}`, "success");
        res.json({ success: true, message: "SMS sent successfully (Simulated)" });
      }, 800);
      return;
    }

    // Real API Request to ss-api
    try {
      const response = await fetch("https://ss-api.domru.ru/api/v1/auth/login-by-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "okhttp/4.9.0",
        },
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        const text = await response.text();
        addLog("Domru", ` Ошибка API при отправке SMS: ${text || response.statusText}`, "error");
        return res.status(response.status).json({ error: "Ошибка провайдера Дом.ру: " + (text || response.statusText) });
      }

      const responseData: any = await response.json();
      addLog("Domru", `SMS-код успешно отправлен Дом.ру для +${phone}.`, "success");
      res.json({ success: true, data: responseData });
    } catch (err: any) {
      const detailedError = getFetchErrorMsg(err);
      addLog("Domru", `Ошибка отправки API запроса: ${detailedError}`, "error");
      res.status(500).json({ error: "Не удалось связаться с серверами Дом.ру: " + detailedError });
    }
  });

  // Confirm SMS OTP Code and fetch Tokens
  app.post("/api/auth/confirm-otp", async (req, res) => {
    let { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: "Номер телефона и код обязательны" });
    }

    phone = phone.replace(/\D/g, "");
    if (phone.startsWith("8")) {
      phone = "7" + phone.substring(1);
    }

    addLog("Domru", `Подтверждение кода ${code} для номера +${phone}...`, "info");

    if (db.simulationMode) {
      if (code === "1234" || code === "12345" || code === "0000" || code.length >= 4) {
        db.phone = phone;
        db.accessToken = "mock_token_" + Math.random().toString(36).substring(2, 10);
        db.refreshToken = "mock_refresh_" + Math.random().toString(36).substring(2, 10);
        db.places = MOCK_PLACES;
        db.domofons = MOCK_DOMOFONS;
        saveDB(db);
        addLog("Domru", "[Симуляция] Успешная авторизация по коду!", "success");
        return res.json({ success: true });
      } else {
        addLog("Domru", "[Симуляция] Неверный код авторизации.", "error");
        return res.status(400).json({ error: "Неверный код авторизации (Попробуйте 1234)" });
      }
    }

    // Real API request
    try {
      const response = await fetch("https://ss-api.domru.ru/api/v1/auth/confirm-login-by-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "okhttp/4.9.0",
        },
        body: JSON.stringify({ phone, code }),
      });

      if (!response.ok) {
        const text = await response.text();
        addLog("Domru", `Ошибка проверки кода: ${text || response.statusText}`, "error");
        return res.status(response.status).json({ error: "Неверный код или ошибка провайдера: " + (text || response.statusText) });
      }

      const tokens: any = await response.json();
      db.phone = phone;
      // Depending on API response schema, tokens can be in fields token/accessToken keys
      db.accessToken = tokens.accessToken || tokens.token || "";
      db.refreshToken = tokens.refreshToken || tokens.refresh_token || "";
      saveDB(db);

      addLog("Domru", `Успешная авторизация в Дом.ру! Получен токен: ${db.accessToken.substring(0, 10)}...`, "success");

      // Attempt to load places immediately
      try {
        const placesResp = await fetch("https://ss-api.domru.ru/api/v1/users/me/places", {
          headers: {
            "Authorization": `Bearer ${db.accessToken}`,
            "User-Agent": "okhttp/4.9.0",
          }
        });
        if (placesResp.ok) {
          const placesData: any = await placesResp.json();
          db.places = placesData.places || placesData || [];
          addLog("Domru", `Загружено адресов: ${db.places.length}`, "success");
          
          // Load domofons for each place
          const domofonsList: any[] = [];
          for (const pl of db.places) {
            const domResp = await fetch(`https://ss-api.domru.ru/api/v1/places/${pl.id}/domofons`, {
              headers: {
                "Authorization": `Bearer ${db.accessToken}`,
                "User-Agent": "okhttp/4.9.0",
              }
            });
            if (domResp.ok) {
              const domData: any = await domResp.json();
              const domArr = domData.domofons || domData || [];
              domofonsList.push(...domArr.map((d: any) => ({ ...d, placeId: pl.id })));
            }
          }
          db.domofons = domofonsList;
          addLog("Domru", `Успешно загружено домофонов: ${db.domofons.length}`, "success");
        }
      } catch (errPlace: any) {
        addLog("Domru", `Не удалось загрузить подробности профиля: ${errPlace.message}. Но авторизация сохранена.`, "info");
      }

      saveDB(db);
      res.json({ success: true });
    } catch (err: any) {
      const detailedError = getFetchErrorMsg(err);
      addLog("Domru", `Исключение при авторизации: ${detailedError}`, "error");
      res.status(500).json({ error: "Не удался запрос подтверждения: " + detailedError });
    }
  });

  // Get active devices
  app.get("/api/devices", async (req, res) => {
    if (db.simulationMode) {
      return res.json({ places: db.places.length ? db.places : MOCK_PLACES, domofons: db.domofons.length ? db.domofons : MOCK_DOMOFONS });
    }

    if (!db.accessToken) {
      return res.status(401).json({ error: "Требуется авторизация в Дом.ру" });
    }

    // Return current cached list or attempt to fetch fresh
    try {
      const placesResp = await fetch("https://ss-api.domru.ru/api/v1/users/me/places", {
        headers: {
          "Authorization": `Bearer ${db.accessToken}`,
          "User-Agent": "okhttp/4.9.0",
        }
      });
      if (placesResp.ok) {
        const placesData: any = await placesResp.json();
        db.places = placesData.places || placesData || [];

        const domofonsList: any[] = [];
        for (const pl of db.places) {
          const domResp = await fetch(`https://ss-api.domru.ru/api/v1/places/${pl.id}/domofons`, {
            headers: {
              "Authorization": `Bearer ${db.accessToken}`,
              "User-Agent": "okhttp/4.9.0",
            }
          });
          if (domResp.ok) {
            const domData: any = await domResp.json();
            const domArr = domData.domofons || domData || [];
            domofonsList.push(...domArr.map((d: any) => ({ ...d, placeId: pl.id })));
          }
        }
        db.domofons = domofonsList;
        saveDB(db);
      }
    } catch (e: any) {
      const detailedError = getFetchErrorMsg(e);
      addLog("Domru", `Не удалось загрузить списки оборудования с серверов: ${detailedError}. Показываем кэшированные.`, "info");
    }

    res.json({ places: db.places, domofons: db.domofons });
  });

  // Open specific Intercom Door
  app.post("/api/devices/open", async (req, res) => {
    const { placeId, domofonId } = req.body;
    if (!placeId || !domofonId) {
      return res.status(400).json({ error: "Отсутствует placeId или domofonId" });
    }

    addLog("Domru", `Получена ручная команда открытия: place ${placeId}, домофон ${domofonId}`, "info");

    if (db.simulationMode) {
      setTimeout(() => {
        addLog("Domru", `[Симуляция] Дверь успешно открыта на 10 секунд!`, "success");
        res.json({ success: true });
      }, 600);
      return;
    }

    if (!db.accessToken) {
      return res.status(401).json({ error: "Требуется авторизация Дом.ру" });
    }

    try {
      const response = await fetch(`https://ss-api.domru.ru/api/v1/places/${placeId}/domofons/${domofonId}/open`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${db.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "okhttp/4.9.0",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        addLog("Domru", `Ошибка API при открытии двери: ${text || response.statusText}`, "error");
        return res.status(response.status).json({ error: "Не удалось открыть дверь: " + (text || response.statusText) });
      }

      addLog("Domru", `Сигнал открытия успешно передан на панель ${domofonId}!`, "success");
      res.json({ success: true });
    } catch (err: any) {
      const detailedError = getFetchErrorMsg(err);
      addLog("Domru", `Исключение при открытии двери: ${detailedError}`, "error");
      res.status(500).json({ error: "Ошибка запроса открытия: " + detailedError });
    }
  });

  // Logs stream endpoint
  app.get("/api/logs", (req, res) => {
    res.json({ logs: apiLogs });
  });

  app.post("/api/logs/clear", (req, res) => {
    apiLogs = [];
    addLog("System", "Журнал логов очищен.", "info");
    res.json({ success: true, logs: apiLogs });
  });

  // Simulated incoming Yandex Command helper (for testing Alice buttons in Web UI)
  app.post("/api/test/incoming-yandex", async (req, res) => {
    const { action, deviceId } = req.body;
    addLog("Yandex", `[Симулятор] Алиса прислала команду "${action}" для устройства ${deviceId}`, "info");
    
    // Parse device elements
    let pId = 112233;
    let dId = 4567;
    if (deviceId && deviceId.startsWith("domru_")) {
      const parts = deviceId.split("_");
      pId = parseInt(parts[2]) || pId;
      dId = parseInt(parts[3]) || dId;
    }

    if (action === "open" || action === "on") {
      addLog("Yandex", `Алиса запустила сценарий открытия. Транслируем в Дом.ру...`, "info");
      
      // Perform opening logic
      if (db.simulationMode) {
        addLog("Domru", "[Симуляция] Успешно открыто по запросу от Алисы!", "success");
        addLog("Yandex", "Алисе отправлен ответ: Дверь открыта (DONE).", "success");
        return res.json({ success: true, status: "DONE" });
      } else {
        try {
          const response = await fetch(`https://ss-api.domru.ru/api/v1/places/${pId}/domofons/${dId}/open`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${db.accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": "okhttp/4.9.0",
            },
          });
          if (response.ok) {
            addLog("Domru", "Успешно открыто по запросу от Алисы!", "success");
            addLog("Yandex", "Алисе отправлен ответ: Дверь открыта (DONE).", "success");
            return res.json({ success: true, status: "DONE" });
          } else {
            addLog("Domru", "Не удалось открыть по сигналу от Алисы.", "error");
            addLog("Yandex", "Алисе возвращена ошибка открытия.", "error");
            return res.status(400).json({ error: "Failed to open door" });
          }
        } catch (e: any) {
          addLog("Yandex", `Исключение при трансляции Yandex действия: ${e.message}`, "error");
          return res.status(500).json({ error: e.message });
        }
      }
    }

    res.json({ success: true });
  });


  // --- OAuth 2.0 Endpoints for Yandex Smart Home integration ---

  app.get("/oauth/authorize", (req, res) => {
    const { client_id, redirect_uri, state, response_type } = req.query;
    
    addLog("System", `Инициирован вход Yandex OAuth. ClientID: ${client_id}`, "info");

    // Inline HTML Auth Approval Page
    const phoneInfo = db.phone ? `+${db.phone}` : "Не авторизован (Включена симуляция)";
    const authStatusText = db.accessToken ? "Связь с Дом.ру установлена" : "Режим Демо-симуляции домофонов";

    const approveUrl = `${redirect_uri}?code=auth_code_${Math.random().toString(36).substring(2, 12)}&state=${state}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Авторизация Yandex Smart Home Bridge</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 32px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            text-align: center;
          }
          .yandex-logo {
            font-size: 24px;
            font-weight: 700;
            color: #ef4444;
            margin-bottom: 8px;
          }
          .title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 24px;
            color: #f1f5f9;
          }
          .info-box {
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 28px;
            text-align: left;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          .info-row:last-child {
            margin-bottom: 0;
          }
          .info-label {
            color: #94a3b8;
          }
          .info-value {
            color: #e2e8f0;
            font-weight: 500;
          }
          .btn {
            background: #ef4444;
            color: white;
            border: none;
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            width: 100%;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
          }
          .btn:hover {
            background: #dc2626;
            transform: translateY(-1px);
          }
          .btn-cancel {
            background: transparent;
            color: #94a3b8;
            margin-top: 12px;
            font-size: 14px;
            cursor: pointer;
            border: none;
          }
          .btn-cancel:hover {
            color: #f1f5f9;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="yandex-logo">Яндекс Умный Дом</div>
          <div class="title">Связывание аккаунтов</div>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            Разрешить Яндексу доступ к управлению вашими умными домофонами Дом.ру через шлюз интеграции?
          </p>
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Аккаунт телефона:</span>
              <span class="info-value">${phoneInfo}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Статус соединения:</span>
              <span class="info-status" style="color: #10b981; font-weight: 600;">${authStatusText}</span>
            </div>
          </div>
          <a href="${approveUrl}" class="btn">Предоставить доступ</a>
          <button class="btn-cancel" onclick="window.close()">Отменить</button>
        </div>
      </body>
      </html>
    `);
  });

  app.post("/oauth/token", (req, res) => {
    addLog("System", `Запрос обмена кода авторизации на токен от Яндекса.`, "info");
    res.json({
      access_token: "yandex_token_access_secret_123",
      refresh_token: "yandex_token_refresh_secret_123",
      expires_in: 31536000,
    });
  });


  // --- Yandex Smart Home API v1.0 Endpoints ---

  // Ping discovery check
  app.get("/v1.0", (req, res) => {
    res.status(200).send("OK");
  });

  // Discovery: return list of smart intercom devices to Yandex UI
  app.get("/v1.0/user/devices", (req, res) => {
    addLog("Yandex", "Запрос списка устройств (Discovery /v1.0/user/devices)", "info");

    const currentDomofons = db.domofons.length ? db.domofons : MOCK_DOMOFONS;
    const currentPlaces = db.places.length ? db.places : MOCK_PLACES;

    const yandexDevices = currentDomofons.map((dom) => {
      const place = currentPlaces.find((p) => p.id === dom.placeId) || currentPlaces[0];
      const addressString = place ? `${place.street}, д. ${place.house}` : "Smart Intercom";
      return {
        id: `domru_device_${dom.placeId}_${dom.id}`,
        name: `Домофон (${dom.name || addressString})`,
        description: `Домофон Дом.ру — ул. ${place?.street || "Усилова"}`,
        room: "Прихожая",
        type: "devices.types.openable", // Standard unlockable openable device
        capabilities: [
          {
            type: "devices.capabilities.on_off",
            retrievable: true,
            reportable: false, // Poll status
          },
        ],
        properties: [],
      };
    });

    res.json({
      request_id: req.header("X-Request-Id") || Math.random().toString(),
      payload: {
        user_id: db.phone || "demo_user",
        devices: yandexDevices,
      },
    });
  });

  // Query state of specific devices (locked or unlocked?)
  app.post("/v1.0/user/devices/query", (req, res) => {
    const { devices } = req.body;
    addLog("Yandex", `Запрос состояния устройств (Query /v1.0/user/devices/query): ${JSON.stringify(devices)}`, "info");

    const requestedDevices = (devices || []).map((dev: any) => {
      return {
        id: dev.id,
        capabilities: [
          {
            type: "devices.capabilities.on_off",
            state: {
              instance: "on",
              value: false, // Momentary lock is always OFF/locked by default
            },
          },
        ],
      };
    });

    res.json({
      request_id: req.header("X-Request-Id") || Math.random().toString(),
      payload: {
        devices: requestedDevices,
      },
    });
  });

  // Control actions (Alice commands e.g. Open the door!)
  app.post("/v1.0/user/devices/action", async (req, res) => {
    const { payload } = req.body;
    const devicesToControl = payload?.devices || [];
    const requestId = req.header("X-Request-Id") || Math.random().toString();

    addLog("Yandex", `Получена команда управления для ${devicesToControl.length} устр.`, "info");

    const actionResults = [];

    for (const dev of devicesToControl) {
      const capabilities = dev.capabilities || [];
      const onCap = capabilities.find((c: any) => c.type === "devices.capabilities.on_off");
      
      if (onCap && onCap.state && onCap.state.instance === "on") {
        const turnOn = onCap.state.value;

        // Extract placeId & domofonId from standard scheme
        // id: domru_device_{placeId}_{domofonId}
        const devIdString = dev.id || "";
        let placeId = 112233;
        let domofonId = 4567;

        if (devIdString.startsWith("domru_device_")) {
          const parts = devIdString.replace("domru_device_", "").split("_");
          placeId = parseInt(parts[0]) || placeId;
          domofonId = parseInt(parts[1]) || domofonId;
        }

        if (turnOn) {
          addLog("Yandex", `Запущен сигнал открытия для ${devIdString} от Яндекс Алисы`, "info");

          let success = false;
          if (db.simulationMode) {
            success = true;
            addLog("Domru", `[Симуляция] Дверь разблокирована успешно Яндекс запросом!`, "success");
          } else {
            try {
              const domResp = await fetch(`https://ss-api.domru.ru/api/v1/places/${placeId}/domofons/${domofonId}/open`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${db.accessToken}`,
                  "Content-Type": "application/json",
                  "User-Agent": "okhttp/4.9.0",
                },
              });
              if (domResp.ok) {
                success = true;
                addLog("Domru", `Дверь успешно разблокирована по API для ${domofonId}!`, "success");
              } else {
                const text = await domResp.text();
                addLog("Domru", ` Ошибка открытия по API для Яндекса: ${text}`, "error");
              }
            } catch (err: any) {
              addLog("Domru", `Исключение при открытии по API для Яндекса: ${err.message}`, "error");
            }
          }

          actionResults.push({
            id: dev.id,
            capabilities: [
              {
                type: "devices.capabilities.on_off",
                state: {
                  instance: "on",
                  action_result: {
                    status: success ? "DONE" : "ERROR",
                    error_code: success ? undefined : "DEVICE_UNREACHABLE",
                    error_message: success ? undefined : "Не удалось связаться с сервером домофона",
                  },
                },
              },
            ],
          });
        } else {
          // Setting on: false is immediately acknowledged as DONE since our momentary latch resides on offByDefault
          actionResults.push({
            id: dev.id,
            capabilities: [
              {
                type: "devices.capabilities.on_off",
                state: {
                  instance: "on",
                  action_result: {
                    status: "DONE",
                  },
                },
              },
            ],
          });
        }
      }
    }

    res.json({
      request_id: requestId,
      payload: {
        devices: actionResults,
      },
    });
  });

  // Unlink trigger
  app.post("/v1.0/user/unlink", (req, res) => {
    addLog("Yandex", "Пользователь отвязал аккаунт в приложении Яндекс.", "info");
    res.json({
      request_id: req.header("X-Request-Id") || Math.random().toString(),
    });
  });


  // --- Vite Dev Server & Static Site Pipeline ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Bridge Server] running on http://localhost:${PORT}`);
    addLog("System", `Локальный веб-интерфейс готов на порту ${PORT}`, "success");
  });
}

startServer();
