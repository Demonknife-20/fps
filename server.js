const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// Silah tanımlamaları
const WEAPONS = {
  pistol: {
    id: 1,
    name: 'Pistol',
    damage: 25,
    fireRate: 200,
    speed: 80,
    lifetime: 300,
    bulletsPerShot: 1,
    color: '#ffff00'
  },
  smg: {
    id: 2,
    name: 'Taramalı',
    damage: 15,
    fireRate: 80,
    speed: 80,
    lifetime: 300,
    bulletsPerShot: 1,
    color: '#00ff00'
  },
  shotgun: {
    id: 3,
    name: 'Shotgun',
    damage: 20,
    fireRate: 600,
    speed: 80,
    lifetime: 300,
    bulletsPerShot: 8,
    spread: 0.3,
    color: '#ffffff'
  },
  bomb: {
    id: 4,
    name: 'Bomba',
    damage: 80,
    fireRate: 1200,
    speed: 40,
    lifetime: 500,
    bulletsPerShot: 1,
    isExplosive: true,
    explosionRadius: 100,
    color: '#000000'
  }
};

const gameState = {
  players: new Map(),
  bullets: [],
  explosions: [],
  worldWidth: 5000,
  worldHeight: 5000,
  worldDepth: 5000
};

let playerIdCounter = 0;

wss.on('connection', (ws) => {
  const playerId = playerIdCounter++;
  const player = {
    id: playerId,
    name: `Player_${playerId}`,
    x: Math.random() * gameState.worldWidth,
    y: 50,
    z: Math.random() * gameState.worldDepth,
    vx: 0,
    vy: 0,
    vz: 0,
    angle: 0,
    pitch: 0,
    speed: 0.3,
    health: 100,
    kills: 0,
    deaths: 0,
    alive: true,
    currentWeapon: 1,
    lastShotTime: 0
  };

  gameState.players.set(playerId, player);
  console.log(`🎮 Oyuncu bağlandı: ${playerId}`);

  ws.send(JSON.stringify({
    type: 'init',
    playerId: playerId,
    worldWidth: gameState.worldWidth,
    worldHeight: gameState.worldHeight,
    worldDepth: gameState.worldDepth,
    weapons: WEAPONS
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'move') {
        player.x = Math.max(0, Math.min(gameState.worldWidth, message.x));
        player.y = Math.max(0, Math.min(200, message.y));
        player.z = Math.max(0, Math.min(gameState.worldDepth, message.z));
        player.angle = message.angle;
        player.pitch = message.pitch;
      }

      if (message.type === 'shoot' && player.alive) {
        const now = Date.now();
        const weapon = Object.values(WEAPONS).find(w => w.id === message.weaponId);
        
        if (weapon && now - player.lastShotTime >= weapon.fireRate) {
          player.lastShotTime = now;
          
          for (let i = 0; i < weapon.bulletsPerShot; i++) {
            let angle = message.angle;
            let pitch = message.pitch;
            
            if (weapon.spread) {
              angle += (Math.random() - 0.5) * weapon.spread;
              pitch += (Math.random() - 0.5) * weapon.spread * 0.5;
            }
            
            const cos_a = Math.cos(angle);
            const sin_a = Math.sin(angle);
            const cos_p = Math.cos(pitch);
            const sin_p = Math.sin(pitch);
            
            const bullet = {
              id: `${playerId}_${Date.now()}_${i}`,
              playerId: playerId,
              x: player.x + cos_a * cos_p * 10,
              y: player.y + sin_p * 10,
              z: player.z + sin_a * cos_p * 10,
              vx: cos_a * cos_p * weapon.speed,
              vy: sin_p * weapon.speed,
              vz: sin_a * cos_p * weapon.speed,
              lifetime: weapon.lifetime,
              damage: weapon.damage,
              isExplosive: weapon.isExplosive,
              explosionRadius: weapon.explosionRadius,
              color: weapon.color,
              weaponType: weapon.name
            };
            gameState.bullets.push(bullet);
          }
        }
      }

      if (message.type === 'changeWeapon') {
        const weapon = Object.values(WEAPONS).find(w => w.id === message.weaponId);
        if (weapon) {
          player.currentWeapon = weapon.id;
        }
      }
    } catch (e) {
      console.error('Hata:', e);
    }
  });

  ws.on('close', () => {
    gameState.players.delete(playerId);
    console.log(`❌ Oyuncu ayrıldı: ${playerId}`);
  });
});

setInterval(() => {
  // Mermi fiziği
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const bullet = gameState.bullets[i];
    bullet.x += bullet.vx;
    bullet.y += bullet.vy - 0.5; // Yerçekimi
    bullet.z += bullet.vz;
    bullet.lifetime--;

    if (
      bullet.lifetime <= 0 ||
      bullet.x < 0 || bullet.x > gameState.worldWidth ||
      bullet.y < 0 || bullet.y > gameState.worldHeight ||
      bullet.z < 0 || bullet.z > gameState.worldDepth
    ) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    // Çarpışma kontrolü
    let hit = false;
    gameState.players.forEach((target) => {
      if (target.id === bullet.playerId || !target.alive) return;

      const dx = target.x - bullet.x;
      const dy = target.y - bullet.y;
      const dz = target.z - bullet.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < 2 && !hit) {
        hit = true;
        
        if (bullet.isExplosive) {
          gameState.explosions.push({
            x: bullet.x,
            y: bullet.y,
            z: bullet.z,
            radius: bullet.explosionRadius,
            lifetime: 30,
            maxLifetime: 30
          });

          gameState.players.forEach((victim) => {
            if (!victim.alive) return;
            const dx = victim.x - bullet.x;
            const dy = victim.y - bullet.y;
            const dz = victim.z - bullet.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < bullet.explosionRadius) {
              const damageMultiplier = 1 - (distance / bullet.explosionRadius);
              const totalDamage = bullet.damage * damageMultiplier;
              victim.health -= totalDamage;

              if (victim.health <= 0) {
                victim.alive = false;
                victim.health = 0;
                victim.deaths++;
                gameState.players.get(bullet.playerId).kills++;

                setTimeout(() => {
                  victim.alive = true;
                  victim.health = 100;
                  victim.x = Math.random() * gameState.worldWidth;
                  victim.y = 50;
                  victim.z = Math.random() * gameState.worldDepth;
                }, 3000);
              }
            }
          });

          gameState.bullets.splice(i, 1);
        } else {
          target.health -= bullet.damage;
          gameState.bullets.splice(i, 1);

          if (target.health <= 0) {
            target.alive = false;
            target.health = 0;
            target.deaths++;
            gameState.players.get(bullet.playerId).kills++;

            setTimeout(() => {
              target.alive = true;
              target.health = 100;
              target.x = Math.random() * gameState.worldWidth;
              target.y = 50;
              target.z = Math.random() * gameState.worldDepth;
            }, 3000);
          }
        }
      }
    });
  }

  // Patlamaları güncelle
  for (let i = gameState.explosions.length - 1; i >= 0; i--) {
    gameState.explosions[i].lifetime--;
    if (gameState.explosions[i].lifetime <= 0) {
      gameState.explosions.splice(i, 1);
    }
  }

  const gameData = JSON.stringify({
    type: 'gameState',
    players: Array.from(gameState.players.values()),
    bullets: gameState.bullets,
    explosions: gameState.explosions
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(gameData);
    }
  });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Oyun sunucusu http://localhost:${PORT} adresinde başladı`);
  console.log(`⚔️ Silahlar: Pistol (1), Taramalı (2), Shotgun (3), Bomba (4)`);
});
