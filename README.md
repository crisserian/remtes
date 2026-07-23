# RemTes

Aplicație gratuită pentru Windows care îți permite să controlezi mașina Tesla direct de pe calculator, prin API-ul oficial Tesla Fleet.

## De ce e sigur

- **Te loghezi cu propriul cont Tesla** (OAuth oficial Tesla) — RemTes nu vede și nu stochează niciodată parola contului tău.
- **Totul rulează local, pe calculatorul tău.** Nu există niciun server intermediar al RemTes care să vadă comenzile tale sau datele mașinii — cererile merg direct din aplicație către API-ul Tesla.
- **Comenzile către mașină sunt semnate criptografic local**, folosind proxy-ul oficial Tesla (`tesla-http-proxy`, din [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command)) — exact mecanismul recomandat de Tesla pentru integrări third-party.
- Codul sursă e public tocmai ca oricine să poată verifica afirmațiile de mai sus.
- **Singura excepție**: la pornire, aplicația face un apel către `grumpylabs.ro/remtes/version.txt` doar ca să verifice dacă a apărut o versiune mai nouă — nu trimite niciun fel de date despre tine sau despre mașină, doar citește un fișier text cu numărul versiunii curente.
- **`tesla-http-proxy.exe` se poate reconstrui local**, din sursa oficială Tesla, nu doar "ai încredere" într-un binar precompilat — vezi [Build din sursă](#build-din-sursă).
- **Domeniul `testrace.netlify.app`** din fluxul OAuth e explicat și documentat integral, cu sursa exactă a paginii — vezi [De ce testrace.netlify.app?](#de-ce-testracenetlifyapp).

## Ce poate face

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

## Cum funcționează

1. La prima rulare, te loghezi cu contul tău Tesla (pagina oficială Tesla, nu una falsă).
2. Aplicația primește de la Tesla un token de acces valabil doar pentru contul tău, stocat local pe calculatorul tău (`app.getPath('userData')`), nu într-o bază de date externă.
3. Când apeși un buton, aplicația trimite comanda către mașină prin proxy-ul de semnare local (`127.0.0.1`), apoi către API-ul Tesla.

## De ce `testrace.netlify.app`?

Tesla cere ca `redirect_uri`-ul din fluxul OAuth să fie un domeniu HTTPS verificat - nu acceptă `localhost` direct. `testrace.netlify.app` e un site static găzduit de mine (dezvoltatorul RemTes) pe Netlify, folosit **exclusiv** ca releu de redirect: primește codul de autorizare de la Tesla și îl retrimite imediat, în browser-ul tău, către `http://localhost:5750`, fără niciun apel de rețea suplimentar. Codul nu ajunge niciodată pe vreun server - pagina doar rescrie URL-ul din propriul tău browser.

Nu trebuie să mă crezi pe cuvânt - asta e întregul conținut al paginii (verificabil oricând cu `curl https://testrace.netlify.app/callback` sau `view-source:`):

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

(Ramura `else` se referă la un relay personal, mai vechi, care nu mai există - RemTes generează întotdeauna un `state` care începe cu `local`, deci ia mereu prima ramură.)

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
| `proxy-tls-cert.pem` / `proxy-tls-key.pem` | certificat TLS self-signed pentru proxy-ul local: `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -keyout proxy-tls-key.pem -out proxy-tls-cert.pem -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"` (SAN-ul e necesar - fără el, Node respinge certificatul la verificarea hostname-ului) |

### `tesla-http-proxy.exe`

Nu trebuie doar "să ai încredere" că binarul inclus vine chiar din [teslamotors/vehicle-command](https://github.com/teslamotors/vehicle-command) - rulează `build-proxy.ps1` din acest repo, care:

1. Clonează `teslamotors/vehicle-command` exact la tag-ul `v0.4.1` (commit `49977a18fd68567501d59e16a6c9e4a8b9348544`) - respinge orice altă rezoluție a tag-ului, în caz că a fost mutat.
2. Compilează `cmd/tesla-http-proxy` local, cu Go-ul instalat pe calculatorul tău.
3. Afișează hash-ul SHA256 al binarului rezultat.

```
powershell -ExecutionPolicy Bypass -File build-proxy.ps1
```

Hash-ul SHA256 al binarului inclus în ultima versiune publicată (1.0.13):

```
5856710984C76289C3CF9AEC2D0E7961F1F18A7FCD7AF0AEFD2A29ADCE2D4F89
```

Dacă rulezi scriptul și obții alt hash pentru același tag, ceva nu e în regulă - spune-mi.

În `server.js`, actualizează `CLIENT_ID` și `OAUTH_REDIRECT_URI` cu valorile aplicației tale.

```
npm install
npm start          # rulează în Electron, pentru testare
npm run dist       # generează installerul NSIS în dist-installer/
```

## Istoric versiuni

### 1.0.16
- Adăugat: buton „Verifică actualizare" în panoul de actualizare software — interoghează starea curentă a mașinii la cerere, în loc să aștepți următorul refresh general.

### 1.0.15
- Adăugat: navigare directă către o stație de încărcare din listă (trimite locația în mașină) + link „Vezi pe hartă" pentru fiecare stație. Notă tehnică: comanda de navigare merge direct către API-ul Tesla, nu prin proxy-ul local de semnare, care o respinge.
- Adăugat: scaune încălzite pentru orice poziție (pasager față, spate stânga/centru/dreapta) — nu doar șofer, ca înainte.
- Adăugat: panou „Actualizare software" — arată versiunea de firmware curentă și starea unui update în curs, cu opțiune de a-l instala imediat sau anula.

### 1.0.14
- Adăugat: ajustare curent de încărcare (amperaj), separat de limita procentuală — util pentru economisirea curentului la încărcare (ex. rămânerea sub limita unui circuit electric de acasă).

### 1.0.13
Remediere a 4 din 6 puncte dintr-un code review primit pe GitHub (vezi și secțiunile noi din acest README):
- Fix: `tesla-http-proxy.exe` se poate acum reconstrui local din sursa oficială Tesla (`build-proxy.ps1`), în loc să fie doar un binar precompilat fără nicio dovadă de proveniență.
- Fix: conexiunea către proxy-ul local de semnare folosea `rejectUnauthorized: false` (accepta orice certificat); acum e pinned pe certificatul propriu, regenerat cu SAN corect (`subjectAltName`).
- Adăugat: handler pentru `SIGHUP` alături de `SIGINT`, pentru curățare consistentă a proceselor.
- Eliminat: mecanismul de sesiuni multi-user (`SESSIONS_DIR`) și tunelul Cloudflare — cod complet neutilizat după ștergerea relay-ului personal `grumpylabs.ro/teslaapp`, care ar fi crescut nelimitat pe disc dacă ar fi fost vreodată activ.
- Documentat: rolul exact al `testrace.netlify.app` în fluxul OAuth, cu sursa completă a paginii inclusă în README.

### 1.0.12
- Fix: linkurile externe (banner-ul de versiune nouă, link-ul de donații) deschideau o fereastră Electron goală, nestilizată, cu meniu implicit, în loc să deschidă browser-ul de sistem. Acum sunt trimise corect către browser-ul implicit.

### 1.0.11
- Modificat: fereastra pornește maximizată, ca să încapă tot conținutul fără bară de scroll pe majoritatea ecranelor.

### 1.0.10
- Fix: titlul ferestrei de confirmare (și al altor dialoguri native) arăta „remtes" cu literă mică — Electron citește câmpul `productName` de la rădăcina `package.json`, nu cel din secțiunea `build`, care era singurul setat până acum.
- Modificat: fereastra e mai lată implicit (1400×900) și panourile se așază pe 3 coloane în loc de 2, ca să folosească spațiul orizontal disponibil în loc să oblige la scroll vertical.

### 1.0.9
- Adăugat: pop-up de confirmare la deschiderea portbagajului spate și a celui față (frunk), la cererea unui user — ca să nu se deschidă din greșeală.

### 1.0.8
- Fix: butoanele de sus (baterie/autonomie/blocare/climatizare) nu se actualizau imediat după o comandă reușită de blocare/climatizare — rămâneau cu valoarea veche până la următorul refresh manual.
- Adăugat: rulare în fundal cu iconiță în system tray — închiderea ferestrei nu mai oprește aplicația, ca notificările de alertă și urmărirea degradării bateriei să funcționeze continuu.
- Adăugat: prag de avertizare pentru presiunea anvelopelor (evidențiere roșie sub 2.2 Bar).
- Adăugat: comutare rapidă între mașini din antet, pentru conturile cu mai multe vehicule Tesla.
- Adăugat: Valet Mode și limitare de viteză cu PIN (activare/dezactivare + setare limită în km/h).
- Adăugat: plecare programată — preîncălzire cabină și încărcare cu tarif redus la o oră stabilită.
- Adăugat: căutare stații de încărcare din apropiere (Supercharger + destinație), cu distanță și locuri libere.

### 1.0.7
- Adăugat: la pornire, aplicația verifică `grumpylabs.ro/remtes/version.txt` și arată un banner discret dacă a apărut o versiune mai nouă, cu link direct de descărcare. Nu e o notificare "push" reală (nu există server care să inițieze conexiunea) — este o verificare locală, la fiecare pornire a aplicației.

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
