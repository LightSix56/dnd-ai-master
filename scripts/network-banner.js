const os = require('os');

const port = process.argv[2] || process.env.PORT || '3000';
const interfaces = os.networkInterfaces();

const localIps = [];
const radminIps = [];
const otherIps = [];

for (const [name, addrs] of Object.entries(interfaces)) {
  for (const iface of addrs || []) {
    if (iface.family === 'IPv4' && !iface.internal) {
      if (iface.address.startsWith('26.') || name.toLowerCase().includes('radmin')) {
        radminIps.push({ ip: iface.address, name });
      } else if (
        iface.address.startsWith('192.168.') ||
        iface.address.startsWith('10.') ||
        iface.address.startsWith('172.')
      ) {
        localIps.push({ ip: iface.address, name });
      } else {
        otherIps.push({ ip: iface.address, name });
      }
    }
  }
}

console.log('================================================================');
console.log('  D&D 5e AI Master & Tactical Battle — Сервер готов к игре');
console.log('================================================================');
console.log('');
console.log('  [1] На этом компьютере (для вас):');
console.log(`      http://localhost:${port}`);
console.log('');

if (radminIps.length > 0) {
  console.log('  [2] Для друзей через Radmin VPN:');
  for (const r of radminIps) {
    console.log(`      http://${r.ip}:${port}`);
  }
  console.log('');
} else {
  console.log('  [2] Radmin VPN не обнаружен:');
  console.log('      (Если играете через Radmin, включите сеть в приложении Radmin VPN)');
  console.log('');
}

if (localIps.length > 0) {
  console.log('  [3] В домашней сети (телефон / планшет / ноутбук по Wi-Fi):');
  for (const l of localIps) {
    console.log(`      http://${l.ip}:${port}`);
  }
  console.log('');
}

console.log('  [!] Если друзья не могут зайти (таймаут / ошибка подключения):');
console.log('      Запустите один раз от имени администратора: open-firewall.bat');
console.log('================================================================');
console.log('');
