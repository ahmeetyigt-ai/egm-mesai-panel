// =========================
// AYAR: Senin Apps Script Web App URL'in
// =========================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyn0rV5vGhLr3u82SPcGwMkIx3ZvzJHnOOfj38wcJwAEYOd0kExEEnHaVJvRVp3Gcdh/exec";

const STORAGE_KEY = "egmMesaiProV1";

const elPersonel = document.getElementById("personel");
const elTodayTotal = document.getElementById("todayTotal");
const elActiveTimer = document.getElementById("activeTimer");
const elHistory = document.getElementById("history");
const elStatus = document.getElementById("statusBadge");
const elTodayText = document.getElementById("todayText");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnReset = document.getElementById("btnReset");
const btnExport = document.getElementById("btnExport");
const btnClearToday = document.getElementById("btnClearToday");

let tickTimer = null;

// ---------- Helpers ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { personel: "", active: null, sessions: [] };
    const data = JSON.parse(raw);
    if (!data.sessions) data.sessions = [];
    return data;
  } catch {
    return { personel: "", active: null, sessions: [] };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMs(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

// Türkiye saatine göre YYYY-MM-DD
function todayTR() {
  const now = new Date();
  const trStr = now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" });
  const trNow = new Date(trStr);
  return trNow.toISOString().slice(0, 10);
}

function nowTRTime() {
  // HH:MM:SS (TR)
  const now = new Date();
  return now.toLocaleTimeString("tr-TR");
}

function requirePerson() {
  const name = (elPersonel.value || "").trim();
  if (!name) {
    alert("Personel adını girin.");
    return null;
  }
  return name;
}

function getTodaySessions(data) {
  const t = todayTR();
  return data.sessions.filter(s => s.tarih === t);
}

function calcTotalMs(sessions) {
  return sessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);
}

// ---------- SHEETS: başlangıç kaydı gönder (CORS'suz) ----------
function sendStartToSheet(personelAdi) {
  const tarih = todayTR();
  const baslangic = nowTRTime();

  const url = SCRIPT_URL
    + "?action=logStart"
    + "&personel=" + encodeURIComponent(personelAdi)
    + "&baslangic=" + encodeURIComponent(baslangic)
    + "&tarih=" + encodeURIComponent(tarih);

  // CORS'a takılmadan "ping" gibi gönderir
  (new Image()).src = url;
}

// ---------- UI ----------
function setStatus(text) {
  elStatus.textContent = text;
}

function stopTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

function startTick() {
  stopTick();
  tickTimer = setInterval(updateUI, 1000);
}

function renderHistory(data) {
  const today = todayTR();
  elTodayText.textContent = today;

  const sessions = getTodaySessions(data);

  if (!sessions.length) {
    elHistory.innerHTML = `<li><div class="muted">Henüz mesai kaydı yok.</div></li>`;
    return;
  }

  elHistory.innerHTML = sessions.map(s => {
    return `
      <li>
        <div>
          <b>${escapeHtml(s.personel)}</b>
          <div class="small">${escapeHtml(s.start)} → ${escapeHtml(s.end)}</div>
        </div>
        <div style="font-family: ui-monospace, Menlo, Consolas, monospace;">
          ${formatMs(s.durationMs)}
        </div>
      </li>
    `;
  }).join("");
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function updateUI() {
  const data = loadData();

  // personel input senkron
  if ((elPersonel.value || "").trim() === "" && data.personel) {
    elPersonel.value = data.personel;
  }

  // bugünkü toplam
  const todaySessions = getTodaySessions(data);
  const totalMs = calcTotalMs(todaySessions);
  elTodayTotal.textContent = formatMs(totalMs);

  // aktif sayaç
  if (data.active && data.active.startEpoch) {
    const elapsed = Date.now() - data.active.startEpoch;
    elActiveTimer.textContent = formatMs(elapsed);
    setStatus("Mesai açık");
    btnStart.disabled = true;
    btnStop.disabled = false;
  } else {
    elActiveTimer.textContent = "00:00:00";
    setStatus("Hazır");
    btnStart.disabled = false;
    btnStop.disabled = true;
  }

  renderHistory(data);
}

// ---------- Actions ----------
btnStart.addEventListener("click", () => {
  const name = requirePerson();
  if (!name) return;

  const data = loadData();
  data.personel = name;

  if (data.active) {
    alert("Zaten aktif bir mesai var.");
    return;
  }

  // local aktif başlat
  data.active = {
    personel: name,
    startEpoch: Date.now(),
    startISO: new Date().toISOString(),
    tarih: todayTR(),
    startText: nowTRTime()
  };

  saveData(data);

  // ✅ Müdür takibi için Sheet'e başlangıç yaz
  sendStartToSheet(name);

  updateUI();
  startTick();
});

btnStop.addEventListener("click", () => {
  const data = loadData();
  if (!data.active) return;

  const endEpoch = Date.now();
  const durationMs = endEpoch - data.active.startEpoch;

  const session = {
    personel: data.active.personel,
    tarih: data.active.tarih,
    start: data.active.startText,
    end: nowTRTime(),
    durationMs
  };

  data.sessions.push(session);
  data.active = null;

  saveData(data);
  stopTick();
  updateUI();
});

btnReset.addEventListener("click", () => {
  const data = loadData();
  data.active = null;
  saveData(data);
  stopTick();
  updateUI();
});

btnClearToday.addEventListener("click", () => {
  if (!confirm("Bugünkü kayıtlar silinsin mi?")) return;
  const data = loadData();
  const today = todayTR();
  data.sessions = data.sessions.filter(s => s.tarih !== today);
  saveData(data);
  updateUI();
});

btnExport.addEventListener("click", () => {
  const data = loadData();
  const today = todayTR();
  const rows = [["personel","tarih","start","end","duration"]];
  data.sessions.filter(s => s.tarih === today).forEach(s => {
    rows.push([s.personel, s.tarih, s.start, s.end, formatMs(s.durationMs)]);
  });

  const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mesai_${today}.csv`;
  a.click();
});

// init
window.addEventListener("load", () => {
  updateUI();
  startTick();
});
