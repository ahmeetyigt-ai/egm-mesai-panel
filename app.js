const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyn0rV5vGhLr3u82SPcGwMkIx3ZvzJHnOOfj38wcJwAEYOd0kExEEnHaVJvRVp3Gcdh/exec";

const STORAGE_KEY = "egmMesaiProV2";

const elPersonel = document.getElementById("personel");
const elTodayTotal = document.getElementById("todayTotal");
const elActiveTimer = document.getElementById("activeTimer");
const elHistory = document.getElementById("history");
const elStatus = document.getElementById("statusBadge");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnReset = document.getElementById("btnReset");

let t = null;

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {personel:"",active:null,sessions:[]}; }
  catch { return {personel:"",active:null,sessions:[]}; }
}
function saveData(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function pad2(n){ return String(n).padStart(2,"0"); }
function fmt(ms){
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const ss = s%60;
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
}

function todayTR(){
  const now = new Date();
  const tr = new Date(now.toLocaleString("en-US",{timeZone:"Europe/Istanbul"}));
  return tr.toISOString().slice(0,10);
}
function timeTR(){
  return new Date().toLocaleTimeString("tr-TR");
}

function ping(url){
  (new Image()).src = url; // CORS yok
}

function sendStart(personel){
  const url = SCRIPT_URL + "?action=logStart"
    + "&personel=" + encodeURIComponent(personel)
    + "&baslangic=" + encodeURIComponent(timeTR())
    + "&tarih=" + encodeURIComponent(todayTR());
  ping(url);
}

function sendEnd(personel){
  const url = SCRIPT_URL + "?action=logEnd"
    + "&personel=" + encodeURIComponent(personel)
    + "&bitis=" + encodeURIComponent(timeTR())
    + "&tarih=" + encodeURIComponent(todayTR());
  ping(url);
}

function update(){
  const d = loadData();
  if (!elPersonel.value.trim() && d.personel) elPersonel.value = d.personel;

  const today = todayTR();
  const todaySessions = d.sessions.filter(s=>s.tarih===today);
  const total = todaySessions.reduce((a,s)=>a+s.ms,0);
  elTodayTotal.textContent = fmt(total);

  if (d.active){
    elStatus.textContent = "Mesai açık";
    btnStart.disabled = true;
    btnStop.disabled = false;
    elActiveTimer.textContent = fmt(Date.now()-d.active.startEpoch);
  } else {
    elStatus.textContent = "Hazır";
    btnStart.disabled = false;
    btnStop.disabled = true;
    elActiveTimer.textContent = "00:00:00";
  }

  elHistory.innerHTML = todaySessions.length ? todaySessions.map(s=>`
    <li>
      <div><b>${s.personel}</b><div class="small">${s.start} → ${s.end}</div></div>
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace">${fmt(s.ms)}</div>
    </li>
  `).join("") : `<li><div class="muted">Henüz mesai kaydı yok.</div></li>`;
}

function tick(){
  clearInterval(t);
  t = setInterval(update,1000);
}

btnStart.addEventListener("click", ()=>{
  const personel = elPersonel.value.trim();
  if(!personel) return alert("Personel adı girin.");

  const d = loadData();
  if(d.active) return alert("Zaten aktif mesai var.");

  d.personel = personel;
  d.active = { personel, startEpoch: Date.now(), start: timeTR(), tarih: todayTR() };
  saveData(d);

  // ✅ Sheet’e başlangıç yaz
  sendStart(personel);

  update();
  tick();
});

btnStop.addEventListener("click", ()=>{
  const d = loadData();
  if(!d.active) return;

  const end = timeTR();
  const ms = Date.now() - d.active.startEpoch;

  d.sessions.push({
    personel: d.active.personel,
    tarih: d.active.tarih,
    start: d.active.start,
    end,
    ms
  });

  // ✅ Sheet’e bitiş yaz (opsiyonel)
  sendEnd(d.active.personel);

  d.active = null;
  saveData(d);
  update();
});

btnReset.addEventListener("click", ()=>{
  const d = loadData();
  d.active = null;
  saveData(d);
  update();
});

window.addEventListener("load", ()=>{
  update();
  tick();
});
