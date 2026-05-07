const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Statik dosyaları serve et
app.use(express.static(path.join(__dirname, 'public')));

// Oyun dünyası
const gameState = {
  players: new Map(),
  bullets: [],
  worldWidth: 5000,
  worldHeight: 5000
};

// Player ID üretici
let playerIdCounter = 0;

// WebSocket bağlantısı
wss.on('connection', (ws) => {
  const playerId = playerIdCounter++;
  const player = {
    id: playerId,
    name: `Player_${playerId}`,
    x: Math.random() * gameState.worldWidth,
    y: Math.random() * gameState.worldHeight,
    angle: 0,
    speed: 5,
    health: 100,
    kills: 0,
    alive: true
  };

  gameState.players.set(playerId, player);
  console.log(`Oyuncu bağlandı: ${playerId}`);

  // Oyuncuya kendisini gönder
  ws.send(JSON.stringify({
    type: 'init',
    playerId: playerId,
    worldWidth: gameState.worldWidth,
    worldHeight: gameState.worldHeight
  }));

  // İstemciden veri al
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'move') {
        player.x = Math.max(0, Math.min(gameState.worldWidth, message.x));
        player.y = Math.max(0, Math.min(gameState.worldHeight, message.y));
        player.angle = message.angle;
      }

      if (message.type === 'shoot') {
        const bullet = {
          id: `${playerId}_${Date.now()}`,
          playerId: playerId,
          x: player.x,
          y: player.y,
          angle: message.angle,
          speed: 8,
          lifetime: 300 // 300ms yaşam süresi
        };
        gameState.bullets.push(bullet);
      }
    } catch (e) {
      console.error('Hata:', e);
    }
  });

  ws.on('close', () => {
    gameState.players.delete(playerId);
    console.log(`Oyuncu ayrıldı: ${playerId}`);
  });
});

// Oyun döngüsü
setInterval(() => {
  // Mermi fiziği
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const bullet = gameState.bullets[i];
    bullet.x += Math.cos(bullet.angle) * bullet.speed;
    bullet.y += Math.sin(bullet.angle) * bullet.speed;
    bullet.lifetime--;

    // Mermi ölüm alanı dışında mı?
    if (
      bullet.lifetime <= 0 ||
      bullet.x < 0 ||
      bullet.x > gameState.worldWidth ||
      bullet.y < 0 ||
      bullet.y > gameState.worldHeight
    ) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    // Çarpışma kontrolü
    gameState.players.forEach((target) => {
      if (target.id === bullet.playerId || !target.alive) return;

      const dx = target.x - bullet.x;
      const dy = target.y - bullet.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 20) {
        target.health -= 25;
        gameState.bullets.splice(i, 1);

        if (target.health <= 0) {
          target.alive = false;
          target.health = 0;
          gameState.players.get(bullet.playerId).kills++;

          // 3 saniye sonra yeniden doğ
          setTimeout(() => {
            target.alive = true;
            target.health = 100;
            target.x = Math.random() * gameState.worldWidth;
            target.y = Math.random() * gameState.worldHeight;
          }, 3000);
        }
      }
    });
  }

  // Tüm oyuncuları gönder
  const gameData = JSON.stringify({
    type: 'gameState',
    players: Array.from(gameState.players.values()),
    bullets: gameState.bullets
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(gameData);
    }
  });
}, 1000 / 60); // 60 FPS

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Oyun sunucusu http://localhost:${PORT} adresinde başladı`);
});
