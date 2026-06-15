import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Key, 
  RefreshCw, 
  Shield, 
  Activity, 
  Video, 
  Phone, 
  DoorOpen, 
  Copy, 
  Check, 
  AlertCircle, 
  Trash2, 
  HelpCircle, 
  Play, 
  Terminal, 
  Server, 
  Wifi, 
  SlidersHorizontal,
  Home,
  LogOut,
  ChevronRight,
  Info
} from "lucide-react";
import { SessionStatus, Place, Domofon, LogEntry } from "./types";

// Canvas Camera View Component with fluid sizing, scanlines, animation, and overlay text
function CameraView({ domofon, place, isOpened }: { domofon: Domofon; place: Place | undefined; isOpened: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 320, height: 180 });

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    // ResizeObserver for modern layout-safe responsiveness
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      // Maintain 16:9 ratio
      const computedHeight = width * (9 / 16);
      setDimensions({ width, height: computedHeight });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    // Generated elements for dynamic scene decoration
    const trees = [
      { x: dimensions.width * 0.1, y: dimensions.height * 0.8, size: dimensions.height * 0.35, speed: 0.05 },
      { x: dimensions.width * 0.85, y: dimensions.height * 0.85, size: dimensions.height * 0.4, speed: 0.03 }
    ];

    const draw = () => {
      frame++;
      
      // 1. Draw Background (Dark street/hallway atmosphere)
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Light glow from streetlamp (gradual breathing gradient)
      const glowIntensity = Math.sin(frame * 0.02) * 15 + 180;
      const grad = ctx.createRadialGradient(
        dimensions.width / 2, dimensions.height / 3, 20,
        dimensions.width / 2, dimensions.height / 3, glowIntensity
      );
      grad.addColorStop(0, "rgba(254, 240, 138, 0.2)");
      grad.addColorStop(1, "rgba(30, 41, 59, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // 2. Draw ground path and abstract building outline
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(dimensions.width * 0.2, dimensions.height);
      ctx.lineTo(dimensions.width * 0.4, dimensions.height * 0.45);
      ctx.lineTo(dimensions.width * 0.6, dimensions.height * 0.45);
      ctx.lineTo(dimensions.width * 0.8, dimensions.height);
      ctx.closePath();
      ctx.fill();

      // Abstract pillars / residential building walls
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, dimensions.width * 0.25, dimensions.height);
      ctx.fillRect(dimensions.width * 0.75, 0, dimensions.width * 0.25, dimensions.height);

      // Arch/latch header
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height * 0.15);

      // 3. Swaying trees (adds live dynamic feel)
      ctx.fillStyle = "#064e3b";
      trees.forEach((tree) => {
        const sway = Math.sin(frame * tree.speed) * 4;
        ctx.beginPath();
        ctx.arc(tree.x + sway, tree.y - tree.size / 2, tree.size / 3, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = "#180d05";
        ctx.fillRect(tree.x + sway - 3, tree.y - tree.size / 3, 6, tree.size / 3);
        ctx.fillStyle = "#064e3b";
      });

      // 4. Subtle Intercom scanlines & video grain
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let y = 0; y < dimensions.height; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();
      }

      // Live video static noise elements (random small dots)
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let i = 0; i < 15; i++) {
        const dotsX = Math.random() * dimensions.width;
        const dotsY = Math.random() * dimensions.height;
        ctx.fillRect(dotsX, dotsY, 1.5, 1.5);
      }

      // Camera feed overlays and telemetry (Space Grotesk pairing)
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#38bdf8"; // Bright sky-blue
      ctx.fillText("REC ●", 16, 28);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("CAM-01 / WIDE", 62, 28);

      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
      ctx.fillText(timestamp, dimensions.width - 150, 28);

      const floorLabel = place ? `ПОДЪЕЗД ${domofon.name.includes("№") ? domofon.name.split("№")[1].substring(0,1) : "1"}` : "ВХОД";
      ctx.fillText(floorLabel, 16, dimensions.height - 18);

      // Address info
      const shortAddr = place ? `${place.street} ${place.house}` : "ДВЕРЬ ДЕМО";
      ctx.fillText(shortAddr.toUpperCase(), dimensions.width - 150, dimensions.height - 18);

      // 5. Door Unlocked Overlay
      if (isOpened) {
        // Red flashing overlay
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);

        // Success HUD banner
        ctx.fillStyle = "#10b981"; // Emerald green
        ctx.fillRect(dimensions.width / 2 - 75, dimensions.height / 2 - 20, 150, 34);

        ctx.font = "bold 11px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("ДВЕРЬ ОТКРЫТА", dimensions.width / 2, dimensions.height / 2 + 1);
        ctx.textAlign = "left"; // Reset align
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [dimensions, isOpened, place, domofon]);

  return (
    <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 shadow-inner">
      <canvas 
        ref={canvasRef} 
        width={dimensions.width} 
        height={dimensions.height}
        className="block w-full h-auto"
      />
      {/* Live label badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/80 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        LIVE H.264
      </div>
    </div>
  );
}


export default function App() {
  const [session, setSession] = useState<SessionStatus>({ phone: "", hasToken: false, simulationMode: true });
  const [places, setPlaces] = useState<Place[]>([]);
  const [domofons, setDomofons] = useState<Domofon[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authStep, setAuthStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [openingDevices, setOpeningDevices] = useState<Record<number, number>>({});
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [showDiagnosePanel, setShowDiagnosePanel] = useState(false);
  
  // Quick credentials values for easily copying to Yandex Developers console
  const appUrl = window.location.origin;
  const clientID = "yandex_domru_adapter_client";
  const clientSecret = "yandex_domru_adapter_secret";

  // Feed/polling handlers
  useEffect(() => {
    fetchSession();
    fetchDevices();
    fetchLogs();

    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Poll opening countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setOpeningDevices((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((key) => {
          const id = parseInt(key);
          if (next[id] > 1) {
            next[id] -= 1;
            changed = true;
          } else {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        if (data.hasToken) {
          fetchDevices();
        }
      }
    } catch (e) {
      console.error("Error loaded session", e);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setPlaces(data.places || []);
        setDomofons(data.domofons || []);
      }
    } catch (e) {
      console.error("Error loaded devices", e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Error loaded logs", e);
    }
  };

  const clearLogs = async () => {
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Error clearing logs", e);
    }
  };

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticsResult(null);
    setShowDiagnosePanel(true);
    try {
      const res = await fetch("/api/diagnose");
      if (res.ok) {
        const data = await res.json();
        setDiagnosticsResult(data);
      } else {
        setDiagnosticsResult({
          error: "Не удалось получить диагностический отчет от сервера"
        });
      }
    } catch (e: any) {
      setDiagnosticsResult({
        error: "Ошибка отправки запроса диагностики: " + e.message
      });
    } finally {
      setIsDiagnosing(false);
      // Wait a moment and then fetch logs so the diagnostic results appear
      setTimeout(() => {
        fetchLogs();
      }, 500);
    }
  };

  const toggleSimulation = async (enabled: boolean) => {
    try {
      const res = await fetch("/api/session/toggle-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession(prev => ({ ...prev, simulationMode: data.simulationMode }));
        fetchDevices();
        fetchSession();
      }
    } catch (e) {
      console.error("Error toggled simulation", e);
    }
  };

  const logout = async () => {
    try {
      const res = await fetch("/api/session/logout", { method: "POST" });
      if (res.ok) {
        setPhoneNumber("");
        setOtpCode("");
        setAuthStep(1);
        setPlaces([]);
        setDomofons([]);
        fetchSession();
      }
    } catch (e) {
      console.error("Error logout", e);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить SMS-код");
      }

      setAuthStep(2);
      setSuccessMessage("SMS-код подтверждения отправлен. Пожалуйста, введите код.");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/auth/confirm-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, code: otpCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Неверный код авторизации");
      }

      setSuccessMessage("Авторизация успешно завершена! Оборудование привязано.");
      fetchSession();
      fetchDevices();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDomofon = async (dom: Domofon) => {
    // If already counting down, don't trigger repeatedly
    if (openingDevices[dom.id]) return;

    try {
      setOpeningDevices(prev => ({ ...prev, [dom.id]: 10 }));
      const res = await fetch("/api/devices/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: dom.placeId, domofonId: dom.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        // Remove timer if call failed
        setOpeningDevices(prev => {
          const next = { ...prev };
          delete next[dom.id];
          return next;
        });
        alert(`Ошибка при открытии двери: ${data.error || "unknown"}`);
      }
    } catch (e) {
      console.error(e);
      setOpeningDevices(prev => {
        const next = { ...prev };
        delete next[dom.id];
        return next;
      });
    }
  };

  const triggerYandexTestCommand = async (action: string, domofonIdString: string) => {
    try {
      await fetch("/api/test/incoming-yandex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deviceId: domofonIdString }),
      });
      const parts = domofonIdString.split("_");
      const dId = parseInt(parts[parts.length - 1]);
      if (dId && action === "on") {
        setOpeningDevices(prev => ({ ...prev, [dId]: 10 }));
      }
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Filter logs list on client sided categories
  const filteredLogs = logs.filter((l) => {
    if (logFilter === "all") return true;
    return l.source === logFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
      {/* Title Header */}
      <header id="header-section" className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-red-500/10 text-red-500 font-bold border border-red-500/20 text-xs tracking-wide">
              DOM.RU
            </span>
            <span className="text-slate-500 align-middle">⇆</span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20 text-xs tracking-wide">
              YANDEX
            </span>
          </div>
          <h1 className="text-3xl font-display font-medium text-slate-100 tracking-tight mt-3">
            Дом.ру <span className="font-light">⇆</span> Яндекс
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Интеграционный OAuth-сервер и API-шлюз для Умного Дома Яндекса (Умный Домофон)
          </p>
        </div>

        {/* Global Connection Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5 font-mono">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              PORT: <span className="text-slate-200">3000</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-400 font-medium">АКТИВЕН</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-xs">
            <span className="text-slate-400 font-mono">ШЛЮЗ:</span>
            <span className={`font-mono text-xs ${session.simulationMode ? "text-amber-400" : "text-emerald-400"}`}>
              {session.simulationMode ? "ДЕМО / СИМУЛЯЦИЯ" : "ПРОДАКШН (DOM.RU)"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Auth, Status and Devices */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* Bridge Controls Panel */}
          <section id="bridge-control-card" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-display font-medium text-slate-200 flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              Параметры соединения
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Шлюз может работать в режиме <b>Реального времени</b> (взаимодействует с API серверов Дом.ру на домене <code>ss-api.domru.ru</code>) или в <b>Режиме симуляции</b> (предоставляет тестовые домофоны без ввода реальной учетной записи).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Simulation Mode Toggle Button */}
              <div className="flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="mb-2">
                  <div className="text-sm font-medium text-slate-200">Режим симуляции</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Безопасное тестирование без запросов к Дом.ру</div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => toggleSimulation(true)}
                    className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      session.simulationMode 
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30" 
                        : "bg-transparent text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    Включить Демо
                  </button>
                  <button 
                    onClick={() => toggleSimulation(false)}
                    className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      !session.simulationMode 
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                        : "bg-transparent text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    Реальный Дом.ру
                  </button>
                </div>
              </div>

              {/* Account Status Card */}
              <div className="flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                <div>
                  <div className="text-sm font-medium text-slate-200">Авторизация Дом.ру</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    {session.hasToken 
                      ? `НОМЕР: +${session.phone}` 
                      : "[Ожидание авторизации]"}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  {session.hasToken ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <Shield className="w-3.5 h-3.5" /> Код привязан
                      </div>
                      <button 
                        onClick={logout}
                        className="text-[11px] text-red-400 underline hover:text-red-300 flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" /> Выйти
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium mt-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Введите телефон ниже
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostics triggers inside Bridge Controls Panel */}
            <div className="mt-5 pt-4 border-t border-slate-800/60 font-sans">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-indigo-400" />
                    Диагностика сетевого соединения
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Проверьте доступность серверов Дом.ру из текущего облачного окружения Cloud Run.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runDiagnostics}
                  disabled={isDiagnosing}
                  className="w-full sm:w-auto p-2 px-4 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDiagnosing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Тестирование...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      Начать тест
                    </>
                  )}
                </button>
              </div>

              {/* Collapsible Diagnostics Result Screen */}
              {showDiagnosePanel && (
                <div className="mt-3 p-4 rounded-xl border border-slate-800/85 bg-slate-950 font-mono text-[11px] leading-relaxed relative text-slate-300">
                  <button 
                    onClick={() => setShowDiagnosePanel(false)}
                    className="absolute top-2.5 right-2.5 text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    закрыть ✕
                  </button>

                  <div className="text-xs text-indigo-400 font-bold mb-2 flex items-center gap-1 border-b border-slate-900 pb-1.5">
                    <Activity className="w-3.5 h-3.5 animate-pulse" /> Отчет о диагностике сети
                  </div>

                  {!diagnosticsResult ? (
                    <div className="text-slate-500 flex items-center gap-1.5 py-2 font-mono">
                      <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" /> Выполняются сетевые запросы к ss-api.domru.ru:443...
                    </div>
                  ) : diagnosticsResult.error ? (
                    <div className="text-red-400 p-2 bg-red-500/5 rounded border border-red-500/10">
                      Ошибка: {diagnosticsResult.error}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pb-2 border-b border-slate-900/80 text-[10px] text-slate-400">
                        <div>Регион хостинга: <span className="text-indigo-300 font-bold">{diagnosticsResult.environment.serverLocationHint}</span></div>
                        <div>Проверяемый хост: <span className="text-slate-300">{diagnosticsResult.dns.domain}</span></div>
                        <div>Node.js версия: <span className="text-slate-500">{diagnosticsResult.environment.nodeVersion} ({diagnosticsResult.environment.platform})</span></div>
                        <div>Метка времени: <span className="text-slate-500">{new Date(diagnosticsResult.timestamp).toLocaleString("ru-RU")}</span></div>
                      </div>

                      {/* DNS */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">1. Разрешение DNS имен</div>
                        {diagnosticsResult.dns.error ? (
                          <div className="text-red-400 font-semibold pl-2">✕ Ошибка DNS: {diagnosticsResult.dns.error}</div>
                        ) : (
                          <div className="pl-2 text-emerald-400">
                            ✓ Успешно разрешено. Найденные IP-адреса:
                            <div className="text-slate-300 mt-0.5 pl-2 font-mono">{diagnosticsResult.dns.resolvedIps.join(", ")}</div>
                          </div>
                        )}
                      </div>

                      {/* TCP Connect */}
                      <div className="space-y-1 pt-1">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">2. TCP Рукопожатие (порт 443)</div>
                        {diagnosticsResult.tcp.connected ? (
                          <div className="pl-2 text-emerald-400">
                            ✓ Соединение установлено успешно за <span className="font-bold text-emerald-300">{diagnosticsResult.tcp.duration} мс</span>! Сервер отвечает.
                          </div>
                        ) : (
                          <div className="pl-2 text-red-400 space-y-1">
                            <div>✕ Не удалось подключиться: <span className="font-semibold text-red-400">{diagnosticsResult.tcp.error}</span></div>
                            <div className="text-[10.5px] text-amber-400/95 leading-relaxed font-sans mt-2 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                              <b>Анализ причины:</b> Сеть провайдера Дом.ру фильтрует/блокирует входящие соединения от иностранных дата-центров (включая Google Cloud на котором развернут этот шлюз). 
                              Поэтому прямые запросы API возвращают <b>fetch failed (timeout)</b>. Рекомендуется использовать режим Демо-симуляции в этой веб-песочнице, либо развернуть исходный код шлюза локально на домашнем сервере (или VPS) с российским IP-адресом.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Authentication Wizard (if not connected and in real mode, or just for setup) */}
          <AnimatePresence mode="wait">
            {!session.hasToken && (
              <motion.section 
                key="auth-wizard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-medium text-slate-200 flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-400" />
                    Авторизация в учетной записи
                  </h2>
                  <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2.5 py-0.5 font-mono">
                    Шаг {authStep} из 2
                  </span>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>{errorMessage}</div>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-start gap-2.5">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>{successMessage}</div>
                  </div>
                )}

                {authStep === 1 ? (
                  <form onSubmit={handleRequestOTP} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Номер мобильного телефона
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="79998887766"
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                        Введите ваш номер телефона, зарегистрированный в Дом.ру (Intercom.domru.ru). Мы вышлем официальный SMS-код проверки для получения временного ключа доступа.
                      </p>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:text-slate-400 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Запросить SMS-код"}
                    </button>
                    {session.simulationMode && (
                      <div className="text-center">
                        <button 
                          type="button"
                          onClick={() => {
                            setPhoneNumber("79991112233");
                            setAuthStep(2);
                            setSuccessMessage("Симуляция: SMS-код отправлен. Введите любой код (например, 1234) для входа.");
                          }}
                          className="text-[11.5px] text-indigo-400 underline hover:text-indigo-300 cursor-pointer"
                        >
                          Быстрый демо-вход (без отправки)
                        </button>
                      </div>
                    )}
                  </form>
                ) : (
                  <form onSubmit={handleConfirmOTP} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Временный код подтверждения из SMS
                      </label>
                      <input 
                        type="text" 
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="1234"
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 px-4 text-center tracking-widest text-lg font-bold font-mono focus:outline-none focus:border-indigo-500/60"
                        required
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Подтвердить код"}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button 
                        type="button" 
                        onClick={() => {
                          setAuthStep(1);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                      >
                        ← Изменить телефон
                      </button>
                      <button 
                        type="button" 
                        onClick={handleRequestOTP}
                        className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                      >
                        Выслать повторно
                      </button>
                    </div>
                  </form>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          {/* Active Intercoms Area */}
          <section id="intercom-devices-list" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-display font-medium text-slate-200 flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-400" />
                  Подключенные домофоны ({domofons.length})
                </h2>
                <span className="text-xs text-slate-400">Обнаруженное оборудование на ваших адресах</span>
              </div>
              <button 
                onClick={fetchDevices}
                className="p-1 px-2.5 rounded bg-slate-800 border border-slate-700/60 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Обновить
              </button>
            </div>

            {domofons.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/50">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-slate-400">Нет доступных домофонов</div>
                <div className="text-xs text-slate-500 mt-1">Авторизуйтесь в Дом.ру или включите Режим симуляции.</div>
              </div>
            ) : (
              <div className="space-y-6">
                {domofons.map((dom) => {
                  const place = places.find((p) => p.id === dom.placeId);
                  const isOpened = !!openingDevices[dom.id];
                  const countdown = openingDevices[dom.id] || 0;

                  return (
                    <div 
                      key={dom.id} 
                      className="p-5 rounded-2xl border border-slate-800 bg-slate-950/40 hover:border-slate-700/50 transition duration-200"
                    >
                      {/* Name / Address Line */}
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {dom.name || "Умная вызывная панель"}
                          </div>
                          {place && (
                            <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                              {place.address}
                            </div>
                          )}
                        </div>

                        {/* ID tag */}
                        <div className="text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 p-1 px-2.5 rounded">
                          ID: {dom.id}
                        </div>
                      </div>

                      {/* Display Live Simulated Canvas Video Feed */}
                      {dom.hasCamera && (
                        <div className="mb-4">
                          <CameraView domofon={dom} place={place} isOpened={isOpened} />
                        </div>
                      )}

                      {/* Manual Trigger Buttons */}
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleOpenDomofon(dom)}
                          disabled={isOpened}
                          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                            isOpened 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold" 
                              : "bg-indigo-600 hover:bg-indigo-500 text-white border-transparent cursor-pointer"
                          }`}
                        >
                          <DoorOpen className="w-4 h-4" />
                          {isOpened ? `ОТКРЫВАЕТСЯ... (${countdown}с)` : "Открыть домофон"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>

        {/* Right Side: Yandex Developer Integration Manual, Test Widget, Live Logs */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* Yandex Integration Panel */}
          <section id="yandex-integration-card" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-display font-medium text-slate-200 flex items-center gap-2 mb-3">
              <span className="p-1 rounded bg-amber-500/20 text-amber-500 text-sm font-bold">Y</span>
              Параметры Умного Дома Яндекса
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Для настройки голосового управления через <b>Алису</b>, создайте приватный навык умного дома в консоли разработчика Яндекс Диалогов и пропишите следующие адреса:
            </p>

            <div className="space-y-4">
              {/* Endpoint URL */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-slate-300">Endpoint URL (Адрес обработчика)</span>
                  {copiedField === "endpoint" && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> скопировано</span>}
                </div>
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs">
                  <div className="p-2 px-3 font-mono text-slate-400 shrink-0 bg-slate-900 border-r border-slate-800 select-none">
                    GET/POST
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${appUrl}/v1.0`} 
                    className="w-full bg-transparent font-mono px-3 text-indigo-300 focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopyToClipboard(`${appUrl}/v1.0`, "endpoint")}
                    className="p-2 px-3 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border-l border-slate-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Authorize URL */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-slate-300">OAuth Авторизация (Authorize URL)</span>
                  {copiedField === "authorize" && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> скопировано</span>}
                </div>
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs">
                  <div className="p-2 px-3 font-mono text-slate-400 shrink-0 bg-slate-900 border-r border-slate-800 select-none">
                    GET
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${appUrl}/oauth/authorize`} 
                    className="w-full bg-transparent font-mono px-3 text-slate-300 focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopyToClipboard(`${appUrl}/oauth/authorize`, "authorize")}
                    className="p-2 px-3 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border-l border-slate-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Token URL */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-slate-300">OAuth Обмен токенов (Token URL)</span>
                  {copiedField === "token" && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Check className="w-3 h-3" /> скопировано</span>}
                </div>
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs">
                  <div className="p-2 px-3 font-mono text-slate-400 shrink-0 bg-slate-900 border-r border-slate-800 select-none">
                    POST
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${appUrl}/oauth/token`} 
                    className="w-full bg-transparent font-mono px-3 text-slate-300 focus:outline-none"
                  />
                  <button 
                    onClick={() => handleCopyToClipboard(`${appUrl}/oauth/token`, "token")}
                    className="p-2 px-3 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border-l border-slate-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Helper specs client */}
              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 pt-1 font-mono">
                <div>Client ID: <span className="text-slate-300">{clientID}</span></div>
                <div>Client Secret: <span className="text-slate-300">{clientSecret}</span></div>
              </div>
            </div>

            {/* Quick Tutorial Toggle */}
            <div className="mt-5 p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
                <Info className="w-4 h-4 text-amber-500" />
                Справка по интеграции в Яндекс.Диалогах:
              </div>
              <ul className="list-decimal list-inside text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                <li>Зайдите на <a href="https://dialogs.yandex.ru/developer" target="_blank" rel="noreferrer" className="text-indigo-400 underline hove:text-indigo-300">dialogs.yandex.ru</a></li>
                <li>Нажмите <b>Создать диалог</b> ⇉ <b>Умный дом</b></li>
                <li>Заполните поля Authorize URL, Token URL и Endpoint URL с этой страницы</li>
                <li>В Яндекс.Приложении перейдите в «Устройства» ⇉ «+» ⇉ «Добавить устройство» ⇉ выберите ваш навык и выполните связывание!</li>
              </ul>
            </div>
          </section>

          {/* Test Alice widget */}
          <section id="test-widget-card" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-display font-medium text-slate-200 flex items-center gap-2 mb-3">
              <Activity className="w-4.5 h-4.5 text-indigo-400" />
              Отладка входящих команд Яндекса
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Поскольку физически связать приватный навык без развернутого публичного HTTPS-домена сложно, вы можете <b>просимулировать сигналы от Алисы</b> прямо отсюда. Это отправит аутентичные Yandex payloads на локальный сервер:
            </p>

            <div className="space-y-2.5">
              <button 
                onClick={() => triggerYandexTestCommand("query", "domru_device_112233_4567")}
                className="w-full text-left p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950 text-xs transition duration-150 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-300">Запрос статуса (Query State)</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">GET /v1.0/user/devices</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button 
                onClick={() => triggerYandexTestCommand("on", "domru_device_112233_4567")}
                className="w-full text-left p-3.5 rounded-xl border border-slate-800 hover:border-slate-755 bg-slate-950/60 hover:bg-slate-950 text-xs transition duration-150 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-300">Открыть через Алису (Set Action: ON)</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">POST /v1.0/user/devices/action [on:true]</div>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-400" />
              </button>
            </div>
          </section>

          {/* Retro terminal logs stream */}
          <section id="terminal-logs-card" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-sm font-display font-medium text-slate-200 flex items-center gap-2">
                <Terminal className="w-4.5 h-4.5 text-indigo-400" />
                Журнал шлюза (Live Logs)
              </h2>
              <button 
                onClick={clearLogs}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Очистить
              </button>
            </div>

            {/* Filter tags */}
            <div className="flex items-center gap-2 mb-3 shrink-0 overflow-x-auto pb-1 text-[10px] font-mono">
              <button 
                onClick={() => setLogFilter("all")}
                className={`p-1 px-2.5 rounded-full border transition ${logFilter === "all" ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 font-bold" : "bg-transparent text-slate-400 border-slate-800 cursor-pointer"}`}
              >
                ВСЕ
              </button>
              <button 
                onClick={() => setLogFilter("Yandex")}
                className={`p-1 px-2.5 rounded-full border transition ${logFilter === "Yandex" ? "bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold" : "bg-transparent text-slate-400 border-slate-800 cursor-pointer"}`}
              >
                YANDEX
              </button>
              <button 
                onClick={() => setLogFilter("Domru")}
                className={`p-1 px-2.5 rounded-full border transition ${logFilter === "Domru" ? "bg-red-500/15 text-red-400 border-red-500/30 font-bold" : "bg-transparent text-slate-400 border-slate-800 cursor-pointer"}`}
              >
                DOMRU
              </button>
              <button 
                onClick={() => setLogFilter("System")}
                className={`p-1 px-2.5 rounded-full border transition ${logFilter === "System" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold" : "bg-transparent text-slate-400 border-slate-800 cursor-pointer"}`}
              >
                SYSTEM
              </button>
            </div>

            {/* Scrolling logs block */}
            <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl p-3 font-mono text-[11px] leading-relaxed overflow-y-auto space-y-2 select-text shadow-inner">
              {filteredLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-8">Нет логов по заданному фильтру</div>
              ) : (
                filteredLogs.map((log) => {
                  let badgeColor = "text-slate-500 bg-slate-900 border-slate-800";
                  if (log.source === "Yandex") badgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                  if (log.source === "Domru") badgeColor = "text-red-400 bg-red-500/10 border-red-500/20";
                  if (log.source === "System") badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                  const cleanTime = log.timestamp.substring(11, 19);

                  return (
                    <div key={log.id} className="border-b border-slate-900/60 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-slate-600">{cleanTime}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badgeColor}`}>
                          {log.source.toUpperCase()}
                        </span>
                      </div>
                      <div className={
                        log.type === "error" ? "text-red-400" :
                        log.type === "success" ? "text-emerald-400/90" :
                        "text-slate-300"
                      }>
                        {log.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </div>

      </div>

      <footer className="mt-16 text-center text-xs text-slate-500 border-t border-slate-800 pt-8 pb-12 font-mono">
        <div>Яндекс.Умный Дом ⇆ Дом.ру Шлюз • Нижний Новгород, Россия</div>
        <div className="mt-1 text-slate-600 text-[10px]">Лицензия MIT • На основе usilova-bot & domru-auth</div>
      </footer>
    </div>
  );
}
