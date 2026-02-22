(() => {
  const STORAGE_KEY = "egm_mesai_pro_v1";

  const el = (id) => document.getElementById(id);

  const personName = el("personName");
  const todayTotal = el("todayTotal");
  const liveTimer = el("liveTimer");
  const statusBadge = el("statusBadge");
  const historyList = el("historyList");
  const todayDate = el("todayDate");

  const btnStart = el("btnStart");
  const btnStop = el("btnStop");
  const btnReset = el("btnReset");
  const btnExport = el("btnExport");
  const btnClearHistory = el("btnClearHistory");

  let interval = null;

  const nowISO = () => new Date().toISOString();
  const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

  const formatTime = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const loadData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {
        personel: "",
        active: null, // { startISO: string }
        sessions: []  // { personel, startISO, endISO, durationMs, dayKey }
      };
      const data = JSON.parse(raw);
      return {
        personel: data.personel || "",
        active: data.active || null,
        sessions: Array.isArray(data.sessions) ? data.sessions : []
      };
    } catch {
      return { personel: "", active: null, sessions: [] };
    }
  };

  const saveData = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const getTodaySessions = (data) => {
    const t = todayKey();
    return data.sessions.filter(s => s.dayKey === t);
  };

  const calcTodayTotal = (data) => {
    const todaySessions = getTodaySessions(data);
    const done = todaySessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    // aktif oturum bugünse canlı süreyi de ekle
    if (data.active?.startISO) {
      const start = new Date(data.active.startISO);
      if (todayKey(start) === todayKey()) {
        return done + (Date.now() - start.getTime());
      }
    }
    return done;
  };

  const setStatus = (state) => {
    // state: "idle" | "running"
    if (state === "running") {
      statusBadge.textContent = "Mesai açık";
      statusBadge.style.borderColor = "rgba(68,209,157,.55)";
      statusBadge.style.background = "rgba(68,209,157,.14)";
    } else {
      statusBadge.textContent = "Hazır";
      statusBadge.style.borderColor = "rgba(255,255,255,.12)";
      statusBadge.style.background = "rgba(255,255,255,.05)";
    }
  };

  const renderHistory = (data) => {
    const todaySessions = getTodaySessions(data);
    if (!todaySessions.length) {
      historyList.innerHTML = `<li class="empty">Henüz mesai kaydı yok.</li>`;
      return;
    }

    // en yeni üstte
    const sorted = [...todaySessions].sort((a, b) => new Date(b.startISO) - new Date(a.startISO));

    historyList.innerHTML = sorted.map((s) => {
      const start = new Date(s.startISO);
      const end = new Date(s.endISO);
      const startTxt = start.toLocaleTimeString("tr-TR");
      const endTxt = end.toLocaleTimeString("tr-TR");
      const durTxt = formatTime(s.durationMs || 0);
      const person = (s.personel || "").trim() || "—";

      return `
        <li>
          <div class="itemLeft">
            <b>${person}</b>
            <div class="itemMeta">${startTxt} → ${endTxt}</div>
          </div>
          <div class="itemRight">
            <div>${durTxt}</div>
            <div class="pill">${s.dayKey}</div>
          </div>
        </li>
      `;
    }).join("");
  };

  const stopTick = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };

  const startTick = () => {
    stopTick();
    interval = setInterval(() => {
      const data = loadData();
      // aktif sayaç
      if (data.active?.startISO) {
        const start = new Date(data.active.startISO).getTime();
        liveTimer.textContent = formatTime(Date.now() - start);
      } else {
        liveTimer.textContent = "00:00:00";
      }
      // bugün toplam
      todayTotal.textContent = formatTime(calcTodayTotal(data));
    }, 250);
  };

  const syncUI = () => {
    const data = loadData();
    personName.value = data.personel || "";

    const running = !!data.active?.startISO;
    btnStart.disabled = running;
    btnStop.disabled = !running;

    setStatus(running ? "running" : "idle");

    if (running) {
      const start = new Date(data.active.startISO).getTime();
      liveTimer.textContent = formatTime(Date.now() - start);
    } else {
      liveTimer.textContent = "00:00:00";
    }

    todayTotal.textContent = formatTime(calcTodayTotal(data));
    renderHistory(data);
  };

  const requirePerson = () => {
    const name = (personName.value || "").trim();
    if (!name) {
      alert("Lütfen personel adını girin.");
      personName.focus();
      return null;
    }
    return name;
  };

  btnStart.addEventListener("click", () => {
    const name = requirePerson();
    if (!name) return;

    const data = loadData();
    if (data.active) return;

    data.personel = name;
    data.active = { startISO: nowISO() };
    saveData(data);

    syncUI();
    startTick();
  });

  btnStop.addEventListener("click", () => {
    const data = loadData();
    if (!data.active?.startISO) return;

    const name = (personName.value || "").trim() || data.personel || "";

    const startISO = data.active.startISO;
    const endISO = nowISO();
    const startMs = new Date(startISO).getTime();
    const endMs = new Date(endISO).getTime();
    const durationMs = Math.max(0, endMs - startMs);

    data.sessions.push({
      personel: name,
      startISO,
      endISO,
      durationMs,
      dayKey: todayKey(new Date(startISO))
    });

    data.personel = name;
    data.active = null;
    saveData(data);

    syncUI();
    startTick();
  });

  btnReset.addEventListener("click", () => {
    const data = loadData();
    if (data.active?.startISO) {
      const ok = confirm("Aktif mesai var. Sıfırlamak mesaiyi iptal eder. Devam edilsin mi?");
      if (!ok) return;
    }

    // sadece aktif sayaç sıfır (geçmişi silmez)
    data.active = null;
    saveData(data);

    syncUI();
    startTick();
  });

  btnClearHistory.addEventListener("click", () => {
    const ok = confirm("Bugüne ait tüm kayıtlar silinsin mi?");
    if (!ok) return;

    const data = loadData();
    const t = todayKey();
    data.sessions = data.sessions.filter(s => s.dayKey !== t);
    saveData(data);

    syncUI();
    startTick();
  });

  btnExport.addEventListener("click", () => {
    const data = loadData();
    if (!data.sessions.length) {
      alert("Dışa aktarılacak kayıt yok.");
      return;
    }

    const header = ["personel", "startISO", "endISO", "durationSeconds", "dayKey"];
    const rows = data.sessions.map(s => ([
      (s.personel || "").replaceAll('"', '""'),
      s.startISO,
      s.endISO,
      String(Math.floor((s.durationMs || 0) / 1000)),
      s.dayKey
    ]));

    const csv = [header, ...rows]
      .map(r => r.map(v => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `egm_mesai_${todayKey()}_export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  });

  // init
  todayDate.textContent = new Date().toLocaleDateString("tr-TR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  // personel adı değişince kaydet
  personName.addEventListener("input", () => {
    const data = loadData();
    data.personel = (personName.value || "").trim();
    saveData(data);
  });

  // yüklenince
  syncUI();
  startTick();
})();