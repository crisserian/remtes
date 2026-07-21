# RemTes

Aplicație gratuită pentru Windows care îți permite să controlezi mașina Tesla direct de pe calculator, prin API-ul oficial Tesla Fleet.

## De ce e sigur

- **Te loghezi cu propriul cont Tesla** (OAuth oficial Tesla) — RemTes nu vede și nu stochează niciodată parola contului tău.
- **Totul rulează local, pe calculatorul tău.** Nu există niciun server intermediar al RemTes care să vadă comenzile tale sau datele mașinii — cererile merg direct din aplicație către API-ul Tesla.
- **Comenzile către mașină sunt semnate criptografic local**, folosind proxy-ul oficial Tesla (`tesla-http-proxy`, din [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command)) — exact mecanismul recomandat de Tesla pentru integrări third-party.
- Codul sursă e public tocmai ca oricine să poată verifica afirmațiile de mai sus.

## Ce poate face

- Blocare / deblocare
- Climate control + scaune / volan încălzite
- Sentry Mode
- Pornit / oprit încărcare + limită procent baterie
- Deschis / închis geamuri, portbagaj față/spate, capacul de încărcare
- Baterie, autonomie, presiune anvelope
- Flash faruri, claxon, trezire mașină

## Cum funcționează

1. La prima rulare, te loghezi cu contul tău Tesla (pagina oficială Tesla, nu una falsă).
2. Aplicația primește de la Tesla un token de acces valabil doar pentru contul tău, stocat local pe calculatorul tău (`app.getPath('userData')`), nu într-o bază de date externă.
3. Când apeși un buton, aplicația trimite comanda către mașină prin proxy-ul de semnare local (`127.0.0.1`), apoi către API-ul Tesla.

## Instalare (pentru utilizatori)

Descarcă installerul de pe [grumpylabs.ro/remtes](https://www.grumpylabs.ro/remtes/). Windows poate arăta un avertisment SmartScreen deoarece aplicația nu are un certificat de semnare plătit — apasă „More info" → „Run anyway".

## Build din sursă

Ai nevoie de propria aplicație Tesla Developer ([developer.tesla.com](https://developer.tesla.com)) cu:
- un `client_id` și `client_secret` (OAuth)
- un domeniu verificat (Partner Account) cu cheia publică găzduită la `/.well-known/appspecific/com.tesla.3p.public-key.pem`
- o pereche de chei EC P-256 pentru virtual key signing

Fișiere necesare, care NU sunt incluse în acest repo (vezi `.gitignore`) și trebuie create manual:

| Fișier | Conținut |
|---|---|
| `client-secret.txt` | client secret-ul OAuth al aplicației tale Tesla, ca text simplu |
| `tesla-private-key.pem` | cheia privată EC P-256 folosită pentru semnarea comenzilor (virtual key) |
| `proxy-tls-cert.pem` / `proxy-tls-key.pem` | certificat TLS self-signed pentru proxy-ul local (`openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 ...`) |

De asemenea trebuie descărcat/compilat `tesla-http-proxy.exe` din [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command).

În `server.js`, actualizează `CLIENT_ID` și `OAUTH_REDIRECT_URI` cu valorile aplicației tale.

```
npm install
npm start          # rulează în Electron, pentru testare
npm run dist       # generează installerul NSIS în dist-installer/
```

## Istoric versiuni

### 1.0.6
- Modificat: eliminată iconița mașinuță de lângă numele „RemTes" din antet.

### 1.0.5
- Modificat: interfața a fost redesenată — iconițe Tabler Icons (SVG, autogăzduite, fără nicio cerere către servicii externe) în loc de emoji, un rând de carduri sus cu baterie/autonomie/blocare/climatizare, panouri colorate pe categorie (siguranță/climatizare/încărcare/portbagaj).
- Adăugat: urmărirea autonomiei la 100% încărcare, într-un grafic simplu — Tesla nu oferă un procent direct de „sănătate baterie" prin API, așa că aplicația reține automat autonomia raportată de fiecare dată când mașina ajunge la 100%, o dată pe zi, ca să arate trendul în timp.
- Fix: la refresh-ul automat de token (o dată la ~8 ore), aplicația pierdea mașina selectată și toate comenzile începeau să eșueze cu „no vehicle selected", fără nicio cale de recuperare vizibilă în interfață.

### 1.0.3
- Adăugat: notificare Windows nativă când apare o alertă nouă a mașinii (Sentry Mode/alarmă etc.), verificată din 2 în 2 minute cât timp aplicația rulează, prin endpoint-ul oficial `recent_alerts`.

### 1.0.2
- Modificat: eticheta „Climate" a fost redenumită „Climatizare" în toată interfața (titlu panou, buton, status live).

### 1.0.1
- Adăugat: când o comandă eșuează cu eroarea „your public key has not been paired with the vehicle", aplicația arată acum un mesaj explicativ cu link direct către pagina de asociere a cheii virtuale, în loc de eroarea brută a API-ului.

### 1.0.0
- Prima versiune publică: login cu propriul cont Tesla, control complet al mașinii (blocare/deblocare, climate, scaune/volan încălzite, Sentry Mode, încărcare + limită procent, geamuri, capac priză, portbagaj față/spate, claxon, faruri, trezire), status live (baterie, autonomie, presiune anvelope), auto-actualizare configurabilă.
- Securitate: protecție CSRF pe comenzile locale, escapare XSS pe datele venite din contul Tesla, protecție login-CSRF prin `state` OAuth aleator cu validare single-use.

## Licență

Fără licență explicită momentan — cod pus la dispoziție doar în scop de transparență și verificare de către utilizatori.
