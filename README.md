# RemTes

Free Windows app that lets you control your Tesla directly from your computer, through Tesla's official Fleet API.
*(Aplicație gratuită pentru Windows care îți permite să controlezi mașina Tesla direct de pe calculator, prin API-ul oficial Tesla Fleet.)*

## De ce e sigur

**English**
- **You log in with your own Tesla account** (official Tesla OAuth) — RemTes never sees or stores your account password.
- **Everything runs locally, on your own computer.** There is no RemTes intermediary server that sees your commands or vehicle data — requests go directly from the app to Tesla's API.
- **Commands to the vehicle are cryptographically signed locally**, using Tesla's official proxy (`tesla-http-proxy`, from [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command)) — exactly the mechanism Tesla recommends for third-party integrations.
- The source code is public precisely so anyone can verify the claims above.
- **The only exception**: on startup, the app makes a request to `grumpylabs.ro/remtes/version.txt` just to check whether a newer version is available — it doesn't send any data about you or your vehicle, it only reads a text file containing the current version number.
- **`tesla-http-proxy.exe` can be rebuilt locally**, from the official Tesla source, instead of just "trusting" a precompiled binary — see [Build din sursă](#build-din-sursă).
- **The `testrace.netlify.app` domain** used in the OAuth flow is fully explained and documented, with the exact page source — see [De ce testrace.netlify.app?](#de-ce-testracenetlifyapp).

**Română**
- **Te loghezi cu propriul cont Tesla** (OAuth oficial Tesla) — RemTes nu vede și nu stochează niciodată parola contului tău.
- **Totul rulează local, pe calculatorul tău.** Nu există niciun server intermediar al RemTes care să vadă comenzile tale sau datele mașinii — cererile merg direct din aplicație către API-ul Tesla.
- **Comenzile către mașină sunt semnate criptografic local**, folosind proxy-ul oficial Tesla (`tesla-http-proxy`, din [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command)) — exact mecanismul recomandat de Tesla pentru integrări third-party.
- Codul sursă e public tocmai ca oricine să poată verifica afirmațiile de mai sus.
- **Singura excepție**: la pornire, aplicația face un apel către `grumpylabs.ro/remtes/version.txt` doar ca să verifice dacă a apărut o versiune mai nouă — nu trimite niciun fel de date despre tine sau despre mașină, doar citește un fișier text cu numărul versiunii curente.
- **`tesla-http-proxy.exe` se poate reconstrui local**, din sursa oficială Tesla, nu doar "ai încredere" într-un binar precompilat — vezi [Build din sursă](#build-din-sursă).
- **Domeniul `testrace.netlify.app`** din fluxul OAuth e explicat și documentat integral, cu sursa exactă a paginii — vezi [De ce testrace.netlify.app?](#de-ce-testracenetlifyapp).

## Ce poate face

**English**
- Lock / unlock
- Climate control + seats (all positions) / steering wheel heater
- Sentry Mode
- Start / stop charging + battery charge limit + charge current (economy)
- Open / close windows, front/rear trunk, charge port
- Battery, range, tire pressure (with low-pressure warning)
- Flash lights, honk horn, wake vehicle
- Valet Mode and speed limit with PIN
- Scheduled departure (preconditioning + off-peak charging)
- Nearby charging stations, with direct navigation to the vehicle and a map link
- Software update info (version, status) + schedule/cancel installation
- Notification on new vehicle alerts, battery degradation tracking over time, automatic new-version check
- Interface available in 9 languages (English, Romanian, German, French, Hungarian, Italian, Spanish, Portuguese, Dutch)

**Română**
- Blocare / deblocare
- Climate control + scaune (toate poziţiile) / volan încălzite
- Sentry Mode
- Pornit / oprit încărcare + limită procent baterie + curent de încărcare (economie)
- Deschis / închis geamuri, portbagaj față/spate, capacul de încărcare
- Baterie, autonomie, presiune anvelope (cu avertizare la presiune scăzută)
- Flash faruri, claxon, trezire mașină
- Valet Mode și limitare de viteză cu PIN
- Plecare programată (preîncălzire + încărcare cu tarif redus)
- Stații de încărcare din apropiere, cu navigare directă către mașină și link către hartă
- Informații actualizare software (versiune, stare) + programare/anulare instalare
- Notificare la alerte noi ale mașinii, urmărirea degradării bateriei în timp, verificare automată de versiune noi
- Interfață disponibilă în 9 limbi (română, engleză, germană, franceză, maghiară, italiană, spaniolă, portugheză, olandeză)

## Cum funcționează

**English**
1. On first run, you log in with your Tesla account (the official Tesla page, not a fake one).
2. The app receives an access token from Tesla valid only for your account, stored locally on your computer (`app.getPath('userData')`), not in any external database.
3. When you press a button, the app sends the command to the vehicle through the local signing proxy (`127.0.0.1`), then to Tesla's API.

**Română**
1. La prima rulare, te loghezi cu contul tău Tesla (pagina oficială Tesla, nu una falsă).
2. Aplicația primește de la Tesla un token de acces valabil doar pentru contul tău, stocat local pe calculatorul tău (`app.getPath('userData')`), nu într-o bază de date externă.
3. Când apeși un buton, aplicația trimite comanda către mașină prin proxy-ul de semnare local (`127.0.0.1`), apoi către API-ul Tesla.

## De ce `testrace.netlify.app`?

**English:** Tesla requires the OAuth flow's `redirect_uri` to be a verified HTTPS domain — it doesn't accept `localhost` directly. `testrace.netlify.app` is a static site hosted by me (the RemTes developer) on Netlify, used **exclusively** as a redirect relay: it receives the authorization code from Tesla and immediately forwards it, in your own browser, to `http://localhost:5750`, with no additional network call. The code never reaches any server — the page just rewrites the URL in your own browser.

**Română:** Tesla cere ca `redirect_uri`-ul din fluxul OAuth să fie un domeniu HTTPS verificat - nu acceptă `localhost` direct. `testrace.netlify.app` e un site static găzduit de mine (dezvoltatorul RemTes) pe Netlify, folosit **exclusiv** ca releu de redirect: primește codul de autorizare de la Tesla și îl retrimite imediat, în browser-ul tău, către `http://localhost:5750`, fără niciun apel de rețea suplimentar. Codul nu ajunge niciodată pe vreun server - pagina doar rescrie URL-ul din propriul tău browser.

You don't have to take my word for it — this is the entire content of the page (verifiable anytime with `curl https://testrace.netlify.app/callback` or `view-source:`) / *Nu trebuie să mă crezi pe cuvânt - asta e întregul conținut al paginii (verificabil oricând cu `curl https://testrace.netlify.app/callback` sau `view-source:`)*:

```html
<!DOCTYPE html>
<html>
<head><title>Tesla Control - redirecting...</title></head>
<body>
<p>Redirecting...</p>
<script>
  var params = new URLSearchParams(window.location.search);
  var state = params.get('state') || '';
  var target = state.indexOf('local') === 0
    ? 'http://localhost:5750/oauth-callback'
    : 'https://www.grumpylabs.ro/teslaapp/oauth-callback.php';
  window.location.replace(target + window.location.search);
</script>
</body>
</html>
```

**English:** (The `else` branch refers to an older, personal relay that no longer exists — RemTes always generates a `state` that starts with `local`, so it always takes the first branch.)

**Română:** (Ramura `else` se referă la un relay personal, mai vechi, care nu mai există - RemTes generează întotdeauna un `state` care începe cu `local`, deci ia mereu prima ramură.)

## Instalare (pentru utilizatori)

**English:** Download the installer from [grumpylabs.ro/remtes](https://www.grumpylabs.ro/remtes/). Windows may show a SmartScreen warning because the app doesn't have a paid signing certificate — click "More info" → "Run anyway".

**Română:** Descarcă installerul de pe [grumpylabs.ro/remtes](https://www.grumpylabs.ro/remtes/). Windows poate arăta un avertisment SmartScreen deoarece aplicația nu are un certificat de semnare plătit — apasă „More info" → „Run anyway".

## Build din sursă

**English:** You need your own Tesla Developer app ([developer.tesla.com](https://developer.tesla.com)) with:
- a `client_id` and `client_secret` (OAuth)
- a verified domain (Partner Account) with the public key hosted at `/.well-known/appspecific/com.tesla.3p.public-key.pem`
- an EC P-256 key pair for virtual key signing

**Română:** Ai nevoie de propria aplicație Tesla Developer ([developer.tesla.com](https://developer.tesla.com)) cu:
- un `client_id` și `client_secret` (OAuth)
- un domeniu verificat (Partner Account) cu cheia publică găzduită la `/.well-known/appspecific/com.tesla.3p.public-key.pem`
- o pereche de chei EC P-256 pentru virtual key signing

Required files, NOT included in this repo (see `.gitignore`), which you must create yourself / *Fișiere necesare, care NU sunt incluse în acest repo (vezi `.gitignore`) și trebuie create manual:*

| Fișier / File | Conținut / Content |
|---|---|
| `client-secret.txt` | client secret-ul OAuth al aplicației tale Tesla, ca text simplu<br>*EN: your Tesla app's OAuth client secret, as plain text* |
| `tesla-private-key.pem` | cheia privată EC P-256 folosită pentru semnarea comenzilor (virtual key)<br>*EN: the EC P-256 private key used to sign commands (virtual key)* |
| `proxy-tls-cert.pem` / `proxy-tls-key.pem` | certificat TLS self-signed pentru proxy-ul local: `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -keyout proxy-tls-key.pem -out proxy-tls-cert.pem -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"` (SAN-ul e necesar - fără el, Node respinge certificatul la verificarea hostname-ului)<br>*EN: self-signed TLS certificate for the local proxy (same command) — the SAN is required; without it, Node rejects the certificate during hostname verification* |

### `tesla-http-proxy.exe`

**English:** You don't have to just "trust" that the included binary really comes from [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command) — run `build-proxy.ps1` from this repo, which:
1. Clones `teslamotors/vehicle-command` at exactly tag `v0.4.1` (commit `49977a18fd68567501d59e16a6c9e4a8b9348544`) — rejects any other resolution of the tag, in case it was moved.
2. Compiles `cmd/tesla-http-proxy` locally, using Go installed on your computer.
3. Prints the SHA256 hash of the resulting binary.

**Română:** Nu trebuie doar "să ai încredere" că binarul inclus vine chiar din [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command) - rulează `build-proxy.ps1` din acest repo, care:
1. Clonează `teslamotors/vehicle-command` exact la tag-ul `v0.4.1` (commit `49977a18fd68567501d59e16a6c9e4a8b9348544`) - respinge orice altă rezoluție a tag-ului, în caz că a fost mutat.
2. Compilează `cmd/tesla-http-proxy` local, cu Go-ul instalat pe calculatorul tău.
3. Afișează hash-ul SHA256 al binarului rezultat.

```
powershell -ExecutionPolicy Bypass -File build-proxy.ps1
```

SHA256 hash of the binary included in the latest published version (1.0.13) / *Hash-ul SHA256 al binarului inclus în ultima versiune publicată (1.0.13):*

```
5856710984C76289C3CF9AEC2D0E7961F1F18A7FCD7AF0AEFD2A29ADCE2D4F89
```

**English:** If you run the script and get a different hash for the same tag, something is wrong — let me know.

**Română:** Dacă rulezi scriptul și obții alt hash pentru același tag, ceva nu e în regulă - spune-mi.

**English:** In `server.js`, update `CLIENT_ID` and `OAUTH_REDIRECT_URI` with your app's values.

**Română:** În `server.js`, actualizează `CLIENT_ID` și `OAUTH_REDIRECT_URI` cu valorile aplicației tale.

```
npm install
npm start          # rulează în Electron, pentru testare
npm run dist       # generează installerul NSIS în dist-installer/
```

## Istoric versiuni / Version history

### 1.1.2
- **RO:** Fix: mesajul brut al API-ului Tesla „vehicle unavailable: vehicle is offline or asleep" apărea netradus, în engleză, indiferent de limba aleasă. Acum e recunoscut și tradus în toate cele 9 limbi, iar dacă utilizatorul schimbă limba în timp ce mesajul e afișat, acesta se re-randează automat în limba nouă.
- **EN:** Fix: the raw Tesla API message "vehicle unavailable: vehicle is offline or asleep" was shown untranslated regardless of the selected language. It's now recognized and translated into all 9 languages, and re-renders automatically if the user switches language while it's displayed.

### 1.1.1
- **RO:** Fix: butoanele toggle (Geamuri, Sentry, Blocare, Climatizare, Scaun, Volan, Capac priză) rămâneau în română când mașina era offline/adormită, pentru că textul lor era actualizat doar după un răspuns reușit de status. Acum toate butoanele toggle, statusul de update, istoricul de baterie și lista de stații din apropiere se re-randează complet la schimbarea limbii, indiferent dacă mașina răspunde sau nu.
- **EN:** Fix: toggle buttons (Windows, Sentry, Lock, Climate, Seat, Steering wheel, Charge port) stayed in Romanian whenever the vehicle was offline/asleep, since their text only updated after a successful status response. All toggle buttons, the update status, the battery history note, and the nearby-charging list now fully re-render on language switch regardless of vehicle connectivity.

### 1.1.0
- **RO:** Adăugat: suport complet multi-limbă — română, engleză, germană, franceză, maghiară, italiană, spaniolă, portugheză, olandeză. La prima pornire apare un ecran de alegere a limbii; ulterior, limba poate fi schimbată oricând dintr-un selector persistent din antet. Alegerea se reține între sesiuni.
- **EN:** Added: full multi-language support — Romanian, English, German, French, Hungarian, Italian, Spanish, Portuguese, Dutch. A language picker appears on first run; the language can be changed anytime afterward from a persistent selector in the header. The choice is remembered between sessions.

### 1.0.18
- **RO:** Modificat: dashboard-ul e împărțit acum în două file — „Principal" (acces & siguranță, climatizare, încărcare, portbagaj) și „Avansat" (valet, plecare programată, stații de încărcare, actualizare software). Rezolvă scroll-ul excesiv pe ecrane mai mici (testat la 1366×768: de la ~600px overflow la ~20px pe fila Principal). Alegerea filei se reține între sesiuni.
- **EN:** Changed: the dashboard is now split into two tabs — "Main" (access & security, climate, charging, trunk) and "Advanced" (valet, scheduled departure, charging stations, software update). Fixes excessive scrolling on smaller screens (tested at 1366×768: from ~600px overflow down to ~20px on the Main tab). The selected tab is remembered between sessions.

### 1.0.17
- **RO:** Modificat: fereastra folosește mai bine spațiul orizontal pe ecrane late — panourile se așază pe 4 coloane (în loc de 3), lățimea maximă a crescut, iar panoul „Actualizare software" a fost reordonat să nu mai stea singur pe un rând întreg. Spațiere ușor redusă peste tot, ca să încapă mai mult fără scroll vertical.
- **EN:** Changed: the window makes better use of horizontal space on wide screens — panels now lay out in 4 columns (up from 3), the max width increased, and the "Software update" panel was reordered so it no longer sits alone on a full row. Spacing was slightly reduced everywhere to fit more content without vertical scrolling.

### 1.0.16
- **RO:** Adăugat: buton „Verifică actualizare" în panoul de actualizare software — interoghează starea curentă a mașinii la cerere, în loc să aștepți următorul refresh general.
- **EN:** Added: "Check for update" button in the software update panel — queries the vehicle's current status on demand, instead of waiting for the next general refresh.

### 1.0.15
- **RO:** Adăugat: navigare directă către o stație de încărcare din listă (trimite locația în mașină) + link „Vezi pe hartă" pentru fiecare stație. Notă tehnică: comanda de navigare merge direct către API-ul Tesla, nu prin proxy-ul local de semnare, care o respinge.
- **EN:** Added: direct navigation to a charging station from the list (sends the location to the vehicle) + a "View on map" link for each station. Technical note: the navigate command goes directly to Tesla's API, not through the local signing proxy, which rejects it.
- **RO:** Adăugat: scaune încălzite pentru orice poziție (pasager față, spate stânga/centru/dreapta) — nu doar șofer, ca înainte.
- **EN:** Added: seat heaters for any position (front passenger, rear left/center/right) — not just the driver's seat, as before.
- **RO:** Adăugat: panou „Actualizare software" — arată versiunea de firmware curentă și starea unui update în curs, cu opțiune de a-l instala imediat sau anula.
- **EN:** Added: "Software update" panel — shows the current firmware version and the status of an update in progress, with the option to install it immediately or cancel.

### 1.0.14
- **RO:** Adăugat: ajustare curent de încărcare (amperaj), separat de limita procentuală — util pentru economisirea curentului la încărcare (ex. rămânerea sub limita unui circuit electric de acasă).
- **EN:** Added: charge current (amperage) adjustment, separate from the percentage limit — useful for saving on charging current (e.g. staying under a home circuit's limit).

### 1.0.13
Remediere a 4 din 6 puncte dintr-un code review primit pe GitHub / *Fixed 4 out of 6 points from a code review received on GitHub* (vezi și secțiunile noi din acest README / *see also the new sections in this README*):
- **RO:** Fix: `tesla-http-proxy.exe` se poate acum reconstrui local din sursa oficială Tesla (`build-proxy.ps1`), în loc să fie doar un binar precompilat fără nicio dovadă de proveniență.
- **EN:** Fix: `tesla-http-proxy.exe` can now be rebuilt locally from the official Tesla source (`build-proxy.ps1`), instead of being just a precompiled binary with no proof of provenance.
- **RO:** Fix: conexiunea către proxy-ul local de semnare folosea `rejectUnauthorized: false` (accepta orice certificat); acum e pinned pe certificatul propriu, regenerat cu SAN corect (`subjectAltName`).
- **EN:** Fix: the connection to the local signing proxy used `rejectUnauthorized: false` (accepted any certificate); it's now pinned to its own certificate, regenerated with the correct SAN (`subjectAltName`).
- **RO:** Adăugat: handler pentru `SIGHUP` alături de `SIGINT`, pentru curățare consistentă a proceselor.
- **EN:** Added: a `SIGHUP` handler alongside `SIGINT`, for consistent process cleanup.
- **RO:** Eliminat: mecanismul de sesiuni multi-user (`SESSIONS_DIR`) și tunelul Cloudflare — cod complet neutilizat după ștergerea relay-ului personal `grumpylabs.ro/teslaapp`, care ar fi crescut nelimitat pe disc dacă ar fi fost vreodată activ.
- **EN:** Removed: the multi-user session mechanism (`SESSIONS_DIR`) and the Cloudflare tunnel — code left completely unused after the personal relay `grumpylabs.ro/teslaapp` was deleted, which would have grown unbounded on disk if it had ever been active.
- **RO:** Documentat: rolul exact al `testrace.netlify.app` în fluxul OAuth, cu sursa completă a paginii inclusă în README.
- **EN:** Documented: the exact role of `testrace.netlify.app` in the OAuth flow, with the page's full source included in the README.

### 1.0.12
- **RO:** Fix: linkurile externe (banner-ul de versiune nouă, link-ul de donații) deschideau o fereastră Electron goală, nestilizată, cu meniu implicit, în loc să deschidă browser-ul de sistem. Acum sunt trimise corect către browser-ul implicit.
- **EN:** Fix: external links (the new-version banner, the donation link) opened a blank, unstyled Electron window with a default menu, instead of opening the system browser. They're now correctly sent to the default browser.

### 1.0.11
- **RO:** Modificat: fereastra pornește maximizată, ca să încapă tot conținutul fără bară de scroll pe majoritatea ecranelor.
- **EN:** Changed: the window now starts maximized, so all content fits without a scrollbar on most screens.

### 1.0.10
- **RO:** Fix: titlul ferestrei de confirmare (și al altor dialoguri native) arăta „remtes" cu literă mică — Electron citește câmpul `productName` de la rădăcina `package.json`, nu cel din secțiunea `build`, care era singurul setat până acum.
- **EN:** Fix: the confirmation dialog's title (and other native dialogs) showed "remtes" in lowercase — Electron reads the `productName` field from the root of `package.json`, not the one in the `build` section, which was the only one set until now.
- **RO:** Modificat: fereastra e mai lată implicit (1400×900) și panourile se așază pe 3 coloane în loc de 2, ca să folosească spațiul orizontal disponibil în loc să oblige la scroll vertical.
- **EN:** Changed: the window is now wider by default (1400×900) and panels lay out in 3 columns instead of 2, to use the available horizontal space instead of forcing vertical scrolling.

### 1.0.9
- **RO:** Adăugat: pop-up de confirmare la deschiderea portbagajului spate și a celui față (frunk), la cererea unui user — ca să nu se deschidă din greșeală.
- **EN:** Added: a confirmation pop-up when opening the rear trunk and the front trunk (frunk), requested by a user — so they don't open by accident.

### 1.0.8
- **RO:** Fix: butoanele de sus (baterie/autonomie/blocare/climatizare) nu se actualizau imediat după o comandă reușită de blocare/climatizare — rămâneau cu valoarea veche până la următorul refresh manual.
- **EN:** Fix: the top buttons (battery/range/lock/climate) didn't update immediately after a successful lock/climate command — they kept the old value until the next manual refresh.
- **RO:** Adăugat: rulare în fundal cu iconiță în system tray — închiderea ferestrei nu mai oprește aplicația, ca notificările de alertă și urmărirea degradării bateriei să funcționeze continuu.
- **EN:** Added: background running with a system tray icon — closing the window no longer stops the app, so alert notifications and battery degradation tracking keep working continuously.
- **RO:** Adăugat: prag de avertizare pentru presiunea anvelopelor (evidențiere roșie sub 2.2 Bar).
- **EN:** Added: a warning threshold for tire pressure (red highlight below 2.2 Bar).
- **RO:** Adăugat: comutare rapidă între mașini din antet, pentru conturile cu mai multe vehicule Tesla.
- **EN:** Added: quick vehicle switching from the header, for accounts with multiple Tesla vehicles.
- **RO:** Adăugat: Valet Mode și limitare de viteză cu PIN (activare/dezactivare + setare limită în km/h).
- **EN:** Added: Valet Mode and speed limiting with a PIN (enable/disable + set limit in km/h).
- **RO:** Adăugat: plecare programată — preîncălzire cabină și încărcare cu tarif redus la o oră stabilită.
- **EN:** Added: scheduled departure — cabin preconditioning and off-peak charging at a set time.
- **RO:** Adăugat: căutare stații de încărcare din apropiere (Supercharger + destinație), cu distanță și locuri libere.
- **EN:** Added: nearby charging station search (Supercharger + destination), with distance and available stalls.

### 1.0.7
- **RO:** Adăugat: la pornire, aplicația verifică `grumpylabs.ro/remtes/version.txt` și arată un banner discret dacă a apărut o versiune mai nouă, cu link direct de descărcare. Nu e o notificare "push" reală (nu există server care să inițieze conexiunea) — este o verificare locală, la fiecare pornire a aplicației.
- **EN:** Added: on startup, the app checks `grumpylabs.ro/remtes/version.txt` and shows a discreet banner if a newer version is available, with a direct download link. It's not a real "push" notification (there is no server initiating the connection) — it's a local check, on every app startup.

### 1.0.6
- **RO:** Modificat: eliminată iconița mașinuță de lângă numele „RemTes" din antet.
- **EN:** Changed: removed the small car icon next to the "RemTes" name in the header.

### 1.0.5
- **RO:** Modificat: interfața a fost redesenată — iconițe Tabler Icons (SVG, autogăzduite, fără nicio cerere către servicii externe) în loc de emoji, un rând de carduri sus cu baterie/autonomie/blocare/climatizare, panouri colorate pe categorie (siguranță/climatizare/încărcare/portbagaj).
- **EN:** Changed: the interface was redesigned — Tabler Icons (SVG, self-hosted, no requests to external services) instead of emoji, a row of cards at the top with battery/range/lock/climate, category-colored panels (safety/climate/charging/trunk).
- **RO:** Adăugat: urmărirea autonomiei la 100% încărcare, într-un grafic simplu — Tesla nu oferă un procent direct de „sănătate baterie" prin API, așa că aplicația reține automat autonomia raportată de fiecare dată când mașina ajunge la 100%, o dată pe zi, ca să arate trendul în timp.
- **EN:** Added: tracking range at 100% charge, in a simple chart — Tesla doesn't offer a direct "battery health" percentage through the API, so the app automatically records the reported range each time the car reaches 100%, once a day, to show the trend over time.
- **RO:** Fix: la refresh-ul automat de token (o dată la ~8 ore), aplicația pierdea mașina selectată și toate comenzile începeau să eșueze cu „no vehicle selected", fără nicio cale de recuperare vizibilă în interfață.
- **EN:** Fix: on the automatic token refresh (about every ~8 hours), the app lost the selected vehicle and all commands started failing with "no vehicle selected", with no visible recovery path in the interface.

### 1.0.3
- **RO:** Adăugat: notificare Windows nativă când apare o alertă nouă a mașinii (Sentry Mode/alarmă etc.), verificată din 2 în 2 minute cât timp aplicația rulează, prin endpoint-ul oficial `recent_alerts`.
- **EN:** Added: native Windows notification when a new vehicle alert appears (Sentry Mode/alarm etc.), checked every 2 minutes while the app is running, through the official `recent_alerts` endpoint.

### 1.0.2
- **RO:** Modificat: eticheta „Climate" a fost redenumită „Climatizare" în toată interfața (titlu panou, buton, status live).
- **EN:** Changed: the "Climate" label was renamed to "Climatizare" (the Romanian word) throughout the interface (panel title, button, live status) — the UI was Romanian-only at the time; the app gained full multi-language support later, in 1.1.0.

### 1.0.1
- **RO:** Adăugat: când o comandă eșuează cu eroarea „your public key has not been paired with the vehicle", aplicația arată acum un mesaj explicativ cu link direct către pagina de asociere a cheii virtuale, în loc de eroarea brută a API-ului.
- **EN:** Added: when a command fails with the "your public key has not been paired with the vehicle" error, the app now shows an explanatory message with a direct link to the virtual key pairing page, instead of the raw API error.

### 1.0.0
- **RO:** Prima versiune publică: login cu propriul cont Tesla, control complet al mașinii (blocare/deblocare, climate, scaune/volan încălzite, Sentry Mode, încărcare + limită procent, geamuri, capac priză, portbagaj față/spate, claxon, faruri, trezire), status live (baterie, autonomie, presiune anvelope), auto-actualizare configurabilă.
- **EN:** First public version: login with your own Tesla account, full vehicle control (lock/unlock, climate, heated seats/steering wheel, Sentry Mode, charging + percentage limit, windows, charge port, front/rear trunk, horn, lights, wake), live status (battery, range, tire pressure), configurable auto-refresh.
- **RO:** Securitate: protecție CSRF pe comenzile locale, escapare XSS pe datele venite din contul Tesla, protecție login-CSRF prin `state` OAuth aleator cu validare single-use.
- **EN:** Security: CSRF protection on local commands, XSS escaping on data coming from the Tesla account, login-CSRF protection via a random OAuth `state` with single-use validation.

## Licență

**English:** No explicit license at the moment — code made available for transparency and user-verification purposes only.

**Română:** Fără licență explicită momentan — cod pus la dispoziție doar în scop de transparență și verificare de către utilizatori.
