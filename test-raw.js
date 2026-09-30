const Ant = require('ant-plus-next');

let stick = new Ant.GarminStick2();
if (!stick.open()) {
  stick = new Ant.GarminStick3();
  if (!stick.open()) {
    console.error('Kein Stick gefunden!');
    process.exit(1);
  }
}

const scanner = new Ant.HeartRateScanner(stick);

// Lauscht auf ALLE internen Events des Scanners
const originalEmit = scanner.emit;
scanner.emit = function (event, ...args) {
  if (event !== 'newListener' && event !== 'removeListener') {
    console.log(`[EVENT GEFEUERT]: "${event}" ->`, JSON.stringify(args[0]));
  }
  return originalEmit.apply(this, [event, ...args]);
};

stick.on('startup', () => {
  console.log('Stick ist bereit. Starte Scan...');
  scanner.scan();
});