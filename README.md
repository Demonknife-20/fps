# FPS Oyunu - Poxel.io Tarzı Çok Oyunculu Oyun

## Kurulum

1. Bağımlılıkları yükle:
```bash
npm install
```

2. Sunucuyu başlat:
```bash
npm start
```

3. Tarayıcıda aç:
```
http://localhost:3000
```

## Kontroller

- **WASD veya Ok Tuşları**: Hareket
- **Fare Hareketi**: Silahı döndür
- **Tıkla**: Ateş et

## Özellikler

✅ Gerçek zamanlı çok oyunculu oyun
✅ WebSocket tabanlı iletişim
✅ Çarpışma algılaması
✅ Sağlık sistemi
✅ Öldürme sayacı
✅ Sıralama tablosu
✅ Yeniden doğma sistemi

## Teknoloji

- **Frontend**: HTML5 Canvas + JavaScript
- **Backend**: Node.js + Express + WebSocket
- **İletişim**: WebSocket (Gerçek zamanlı)

## Oyun Mekanikleri

- Her oyuncu 100 HP ile başlar
- Her mermi 25 hasar verir
- Oyuncu öldüğünde 3 saniye sonra yeniden doğar
- Sıralama en çok öldürüme göre yapılır
