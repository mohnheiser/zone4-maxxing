const wsUrl = `ws://${window.location.host}`;
let socket;
const tilesContainer = document.getElementById('tilesContainer');
const inZoneCountEl = document.getElementById('inZoneCount');
const groupAvgBpmEl = document.getElementById('groupAvgBpm');
const totalAthletesEl = document.getElementById('totalAthletes');
const modeBadgeEl = document.getElementById('modeBadge');

function getZoneInfo(percentage) {
  if (percentage < 60) return { zone: 'Z1', class: 'z1', label: 'Zone 1' };
  if (percentage < 70) return { zone: 'Z2', class: 'z2', label: 'Zone 2' };
  if (percentage < 80) return { zone: 'Z3', class: 'z3', label: 'Zone 3' };
  if (percentage < 90) return { zone: 'Z4', class: 'z4', label: 'Zone 4 Max' };
  return { zone: 'Z5', class: 'z5', label: 'Zone 5 Peak' };
}

function connect() {
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    modeBadgeEl.textContent = 'VERBUNDEN';
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'HEART_RATES') {
      render(msg.data, msg.mode);
    }
  };

  socket.onclose = () => {
    modeBadgeEl.textContent = 'OFFLINE (RECONNECT)';
    modeBadgeEl.className = 'badge';
    setTimeout(connect, 2000);
  };
}

function render(trackers, mode) {
  // Badge updaten
  modeBadgeEl.textContent = mode;
  modeBadgeEl.className = `badge ${mode.toLowerCase()}`;

  // Summary Werte berechnen
  let totalBpm = 0;
  let inZone4Or5Count = 0;

  trackers.forEach(t => {
    totalBpm += t.bpm;
    const percent = Math.round((t.bpm / t.maxHr) * 100);
    if (percent >= 80) inZone4Or5Count++;
  });

  totalAthletesEl.textContent = trackers.length;
  inZoneCountEl.textContent = `${inZone4Or5Count} / ${trackers.length}`;
  groupAvgBpmEl.textContent = trackers.length > 0 
    ? `${Math.round(totalBpm / trackers.length)} BPM` 
    : '-- BPM';

  // Kacheln synchronisieren
  const currentIds = new Set(trackers.map(t => t.id));

  // Entferne getrennte Teilnehmer
  Array.from(tilesContainer.children).forEach(child => {
    if (!currentIds.has(child.id)) {
      child.remove();
    }
  });

  // Aktualisiere oder erstelle Kacheln
  trackers.forEach(t => {
    const percent = Math.min(Math.round((t.bpm / t.maxHr) * 100), 120);
    const zoneInfo = getZoneInfo(percent);

    let card = document.getElementById(t.id);
    if (!card) {
      card = document.createElement('div');
      card.id = t.id;
      tilesContainer.appendChild(card);
    }

    card.className = `athlete-card ${zoneInfo.class}`;
    card.innerHTML = `
      <div class="card-header">
        <span class="athlete-name">${t.name}</span>
        <span class="zone-indicator">${zoneInfo.label}</span>
      </div>
      <div class="card-body">
        <span class="bpm-number">${t.bpm}</span>
        <span class="bpm-unit">BPM</span>
      </div>
      <div class="card-footer">
        <div class="percentage-bar-bg">
          <div class="percentage-bar-fill" style="width: ${Math.min(percent, 100)}%;"></div>
        </div>
        <div class="percentage-text">${percent}% HFmax</div>
      </div>
    `;
  });
}

// Fullscreen-Funktion
document.getElementById('fullscreenBtn').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
});

// Starten
connect();