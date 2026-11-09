# Worldmind

On ülkenin yapay zekâ başkanlar tarafından yönetildiği, yaşayan 2D izometrik dünya simülasyonu.

## Bilgisayarında çalıştırma

1. Node.js 18 veya üstü kurulu olmalı (`node -v`).
2. Bu klasörde `start.bat` dosyasına çift tıkla. Ya da terminalde `npm start` yaz.
3. Tarayıcıda `http://localhost:8080` açılır.

Ek paket kurulumu gerekmez.

## Yapay zekâ başkanlar

Başkanlar üç katmanda düşünür:

| Katman | Ne zaman | Ücret |
|---|---|---|
| Yerel ajan | Her zaman, tarayıcıda | Ücretsiz |
| Sunucu ajanı | Oyun bu sunucudan açıldığında | Ücretsiz modeller |
| Claude | Oyun claude.ai içinde açıldığında | Claude hesabın |

Sunucu, `.env` dosyasındaki sırayla sağlayıcıları dener. İlk çalışan kullanılır:

- **Pollinations:** Anahtarsız çalışır. Anonim kota sınırlıdır.
- **Groq:** Ücretsiz katmanı vardır. En güvenilir seçenek budur. Anahtarı https://console.groq.com/keys adresinden al.
- **OpenRouter:** Adında `:free` geçen modeller ücretsizdir.
- **Ollama:** Kendi makinende yerel model çalıştırır.

Bir sağlayıcı yanıt vermezse o başkan o tur yerel ajanla karar verir. Oyun durmaz.

## Sunucuya ve alan adına yayınlama

### Seçenek A: Docker ve Caddy (önerilen, otomatik HTTPS)

1. Bir VPS kirala (Ubuntu, 1 GB RAM yeterli). Docker’ı kur.
2. Alan adının DNS ayarlarında `A` kaydını VPS’in IP adresine yönlendir.
3. Projeyi sunucuya kopyala. `.env.example` dosyasını `.env` olarak kopyalayıp doldur.
4. `deploy/Caddyfile` içindeki `senin-alan-adin.com` yazısını kendi alan adınla değiştir.
5. Şu komutları çalıştır:
   ```
   cd deploy
   docker compose up -d --build
   ```

Caddy SSL sertifikasını otomatik alır ve yeniler.

### Seçenek B: Node ve PM2

```
npm install -g pm2
pm2 start server/server.js --name dunya10
pm2 save && pm2 startup
```

Önüne Nginx ya da Caddy koyup 8080 portuna yönlendir.

## Tek dosya sürümü

`npm run build:single` komutu `dist/dunya10.html` dosyasını üretir. Bu dosya sunucusuz açılır. Bu modda başkanlar yerel ajanla, claude.ai içinde ise Claude ile çalışır.

## Klasör yapısı

```
client/        oyun (HTML, CSS, JS modülleri)
  js/00-core       sabitler, veri tanımları
  js/10-world      dünya üretimi, şehirler, yollar
  js/20-sim        ekonomi, olaylar, büyüme, savaş, gemiler, uçaklar
  js/30-movement   trafik fiziği (şerit, viraj, takip mesafesi, ışıklar)
  js/40-agents-ai  başkan ajanları ve LLM sağlayıcıları
  js/50-art        prosedürel sprite sanatı
  js/60-render     çizim motoru
  js/70-ui         arayüz
  js/80-main       ana döngü
server/server.js   statik sunucu + /api/agent (LLM zinciri, hız sınırı)
deploy/            Caddy ve docker-compose
```

## Kontroller

- **Kamerayı kaydırmak:** Haritayı sürükle ya da WASD veya ok tuşlarını kullan.
- **Yakınlaştırmak:** Tekerleği ya da iki parmağı kullan.
- **Zaman:** Boşluk tuşu durdurur, 1–5 tuşları hızı seçer.
- **İnceleme:** Bir insana tıklarsan takip edebilir ve onunla konuşabilirsin. Bir binaya tıklarsan içindekileri görürsün.

## Emeği geçenler

- Askerî araç modelleri: Low Poly Models by @Zsky_01, lisans CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
- Şehir, araç ve gemi modelleri: Kenney (https://kenney.nl), lisans CC0.
- Savaş gemileri: WW2 RTS & SLG Naval Fleet Pack by winyunq, lisans CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Kaynak: https://www.fab.com/listings/e5c0cbd6-06a5-4b36-b2c8-1e9263c97e15. Değişiklik: izometrik 2D sprite olarak render edildi.
- Savaş jetleri: Fighter Jets by ikrambandagi (https://ikrambandagi.itch.io/fighter-jets), ücretsiz paket.
