const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const isSimMode = process.argv.includes('--sim');

// Statische Dateien aus /public bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Konfiguration laden
let config = { defaultMaxHr: 195, participants: {} };
try {
  const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
  config = JSON.parse(configFile);
} catch (e) {
  console.log('[Config] Standard-Konfiguration wird verwendet.');
}

// Speicher für aktuelle Herzfrequenz-Daten
const activeTrackers = new Map();

// -------------------------------------------------------------
// 1. ANT+ Hardware Setup
// -------------------------------------------------------------
function setupAntPlus() {
  let Ant;
  try {
    Ant = require('ant-plus-next');
  } catch (err) {
    console.warn('[ANT+] Modul "ant-plus-next" nicht gefunden. Starte im Simulationsmodus.');
    startSimulation();
    return;
  }

  // Günstige Sticks nutzen meist Stick2 (0x1008), Garmin Original Stick3 (0x1009)
  let stick = new Ant.GarminStick2();
  let scanner = null;

  function initScanner() {
    scanner = new Ant.HeartRateScanner(stick);

    scanner.on('heartRateData', (data) => {
      const deviceId = String(data.DeviceId || data.DeviceID);
      const bpm = data.ComputedHeartRate;

      // Terminal-Feedback für jedes Signal
      console.log(`[ANT+ Live] Gerät #${deviceId} -> ${bpm} BPM`);

      // Nur plausible Werte verarbeiten
      if (bpm && bpm > 30 && bpm < 240) {
        const participant = config.participants[deviceId] || {
          name: `Gurt #${deviceId}`,
          maxHr: config.defaultMaxHr
        };

        activeTrackers.set(deviceId, {
          id: deviceId,
          name: participant.name,
          maxHr: participant.maxHr,
          bpm: bpm,
          lastSeen: Date.now()
        });
      }
    });

    stick.on('startup', () => {
      console.log('[ANT+] Stick initialisiert. Scan für Herzfrequenzgurte gestartet...');
      scanner.scan();
    });
  }

  // Versuch 1: Stick 2
  if (!stick.open()) {
    console.log('[ANT+] Stick Typ 2 nicht erkannt, probiere Stick Typ 3...');
    stick = new Ant.GarminStick3();
    if (!stick.open()) {
      console.warn('[ANT+] Kein ANT+ Stick gefunden! Wechsel in den Simulations-Modus.');
      startSimulation();
      return;
    }
  }

  initScanner();
}

// -------------------------------------------------------------
// 2. Simulations-Modus (für Tests ohne Hardware)
// -------------------------------------------------------------
function startSimulation() {
  console.log('--- SIMULATIONS-MODUS AKTIV ---');
  const mockNames = ['Johnny Sins', 'Ryan Stecken', 'Tim', 'Anna', 'Felix', 'Jonas', 'Elena', 'Maximilian'];
  
  mockNames.forEach((name, i) => {
    const id = `SIM_${1000 + i}`;
    activeTrackers.set(id, {
      id: id,
      name: name,
      maxHr: 190 + (i % 5),
      bpm: 120 + Math.floor(Math.random() * 40),
      lastSeen: Date.now()
    });
  });

  // Pulswerte dynamisch variieren lassen
  setInterval(() => {
    activeTrackers.forEach((tracker) => {
      const delta = Math.floor(Math.random() * 7) - 3; // -3 bis +3 BPM
      tracker.bpm = Math.min(Math.max(tracker.bpm + delta, 110), tracker.maxHr + 2);
      tracker.lastSeen = Date.now();
    });
  }, 1000);
}

// -------------------------------------------------------------
// 3. WebSocket Broadcast (1x pro Sekunde)
// -------------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  const payload = [];

  activeTrackers.forEach((data, id) => {
    // Wenn 12 Sekunden lang kein Paket kam -> Sensor als offline werten
    if (now - data.lastSeen > 12000) {
      activeTrackers.delete(id);
    } else {
      payload.push(data);
    }
  });

  const message = JSON.stringify({
    type: 'HEART_RATES',
    mode: isSimMode ? 'SIMULATION' : 'LIVE',
    data: payload
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}, 1000);

// Server starten
server.listen(PORT, () => {
  console.log(`[Zone 4 Dashboard] Läuft auf http://localhost:${PORT}`);
  if (isSimMode) {
    startSimulation();
  } else {
    setupAntPlus();
  }
});