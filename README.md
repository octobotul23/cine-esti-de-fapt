# Cine ești, de fapt?

Site de teste de autocunoaștere („Cine ești, de fapt?”) și test de cuplu („Cât ne cunoaștem?”).
Are trei părți: site-ul pentru vizitatori, panoul de administrare și un server mic care le ține pe amândouă.

Nu are nevoie de `npm install`. Îi trebuie doar Node.js 20 sau mai nou.

## Pornire

```bash
node server/server.js
```

Site-ul se deschide la `http://localhost:5180`.

Înainte de prima folosire a panoului, creați contul de administrare (vezi mai jos).

## Contul de administrare

Contul se creează doar din terminal. Nu există pagină de înregistrare.

```bash
node server/manage.js create-admin adresa@exemplu.ro
```

Comanda cere parola de două ori, iar ce tastați nu se vede pe ecran. Parola are nevoie de cel puțin 12 caractere.
Aceeași comandă, cu o adresă care există deja, îi schimbă parola.

Alte comenzi:

```bash
node server/manage.js list
```

```bash
node server/manage.js remove adresa@exemplu.ro
```

Dacă serverul folosește alt folder de date, dați-l și aici: `node server/manage.js create-admin adresa@exemplu.ro --data=/cale/date`.

## Unde este panoul

- Adresa: `/admin` (de exemplu `http://localhost:5180/admin`).
- Pe site nu există niciun link către el. Pagina are `noindex` și nu apare în sitemap.
- Gest ascuns, oriunde pe site:
  - pe calculator: tastați `admin` (nu într-un câmp de text);
  - pe telefon: atingeți de 5 ori la rând semnul © din subsol.

## Ce se schimbă din fiecare secțiune a panoului

Modificările rămân în panou până apăsați „Salvați” în bara de jos. „Renunțați” le aruncă.
Codurile promo fac excepție: ele se salvează pe loc.

| Secțiune | Ce schimbă pe site |
| --- | --- |
| **Texte** | Toate textele din pagini, pe grupe: prima pagină, pagina cu testele, textele din timpul unui test, rezultatul, tarotul, raportul, testul de cuplu, plata, „Linkul meu”, meniul și subsolul, butoanele și mesajele scurte, confidențialitatea și termenii. La „Prima pagină” sunt și rândul de sub titlul mare, butonul mare, cele trei carduri (tu, voi doi, tarot) și, pentru fiecare card de preț, rândurile cu bifă, butonul și eticheta din colț. La „Meniu și subsol” sunt numele din meniul de sus și cele două butoane din colț. Are căutare. |
| **Prețuri** | Numele, descrierea și prețul de pe cardurile de preț din prima pagină: pentru un test, pentru tot pachetul și pentru testul de cuplu; ce se poate cumpăra și ce nu; moneda. Unealta „Recalculați prețurile” mărește sau scade toate sumele cu un procent și le poate rotunji la ,99. |
| **Teste** | Lista de teste (nume, descriere, ordine, vizibile sau ascunse), întrebările fiecărui test și care dintre ele sunt gratuite, trăsăturile măsurate și textele lor (scor mic, mediu, mare, sfat), la IQ variantele de răspuns, răspunsul corect și intervalele afișate, scala de răspuns și pragurile de scor mic/mare. |
| **Test de cuplu** | Întrebările și variantele lor, câte sunt gratuite, temele raportului și concluzia pe trei trepte. |
| **Tarot** | Textele celor 22 de cărți și pozițiile etalării (între 1 și 5 cărți). |
| **Raport** | Titlurile de profil, introducerile capitolelor, rândul despre IQ și provocarea de 7 zile. |
| **Coduri promo** | Creați coduri de reducere: procent (0–100%) sau „2 + 1 gratis”. Puteți scrie codul sau îl lăsați generat. Opțional: număr maxim de folosiri, dată de expirare, notă. Un cod poate fi oprit, repornit sau șters. |
| **Setări** | Numele site-ului și al testului de cuplu, adresa de contact, titlul și descrierea din Google, dacă oamenii își pot lăsa e-mailul; plățile (starea lor, metodele și ordinea lor, moneda, cursul euro, tarifele de SMS; vedeți „Plăți” mai jos); versiunile salvate (ultimele 30, oricare se poate readuce) și revenirea la valorile implicite; cifre, comenzi și lista de adrese de e-mail (CSV); schimbarea parolei; jurnalul. Jos, în colț, scrie mic versiunea care rulează (de ex. „v0.3.0 · urcată pe 13.11.2026”); numărul vine din `package.json` și se vede doar în panou. |

### Două reguli pentru texte

- Cuvintele între acolade, de exemplu `{n}` sau `{nume}`, sunt înlocuite automat cu numărul sau numele potrivit. Lăsați-le așa cum sunt.
- După un număr de la 20 în sus, site-ul adaugă singur „de”: „`{n}` întrebări” devine „50 de întrebări”, dar „8 întrebări”.

## Plăți

Plata are trei stări, alese din Setări → Plăți:

- **De probă** (așa pornește site-ul): oricine apasă „Plătește” primește acces fără să plătească. Folosiți-o doar la teste, nu pe un site public.
- **Reale**: se încasează bani prin metodele pornite în panou și pregătite pe server.
- **Oprite**: nu se poate cumpăra nimic; testele gratuite merg în continuare.

Un cod promo de 100% deblochează fără plată, în orice stare.

### Metodele de plată

| Metoda | Prin cine | Ce vede clientul |
| --- | --- | --- |
| **Card, Apple Pay, Google Pay** | Stripe Checkout | Este dus pe pagina Stripe. Acolo apar cardul, Apple Pay, Google Pay, Link și orice altă metodă porniți în contul Stripe (Settings → Payment methods), fără nicio schimbare pe site. |
| **PayPal** | PayPal, legat direct | Este dus pe pagina PayPal. Suma se încasează în euro, la cursul scris în panou. |
| **SMS, pe factura de telefon** | un agregator de SMS cu suprataxă | Trimite un SMS cu un cod la un număr scurt. Pagina se deblochează singură când sosește mesajul. |

Din panou (Setări → Plăți) schimbați: care metode apar, în ce ordine, cu ce nume și explicație, moneda, cursul euro, tarifele de SMS (număr scurt, cuvânt-cheie, cost) și SMS-urile de răspuns. Tot acolo, la fiecare metodă, scrie dacă este pregătită pe server și ce lipsește.

**Cheile secrete nu se pun în panou.** Se dau serverului prin variabile de mediu, de exemplu într-un fișier `.env` (care nu se pune în git):

```
PUBLIC_URL=https://exemplu.ro
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_ENV=live
SMS_HOOK_SECRET=un-text-lung-la-intamplare
```

```bash
node --env-file=.env server/server.js
```

O metodă pornită în panou, dar fără chei pe server, nu apare pe site în starea „Reale”.

### Stripe (card, Apple Pay, Google Pay)

1. În contul Stripe, la Developers → API keys, luați cheia secretă și puneți-o în `STRIPE_SECRET_KEY`. Cu o cheie de probă (`sk_test_…`) puteți încerca toată plata cu cardurile de test Stripe, fără bani adevărați. Se poate folosi și o cheie restricționată (`rk_…`) care are voie doar să scrie la „Checkout Sessions”.
2. La Developers → Webhooks adăugați adresa `https://domeniul-dvs/api/hook/stripe` (o găsiți și în panou), cu evenimentele `checkout.session.completed` și `checkout.session.async_payment_succeeded`. Secretul de semnare primit (`whsec_…`) merge în `STRIPE_WEBHOOK_SECRET`.
3. Reporniți serverul, apoi alegeți „Reale” în panou.

Fără webhook plata merge, dar un client care închide pagina imediat după ce a plătit rămâne fără acces până revine pe linkul de întoarcere. Cu webhook, accesul se deblochează oricum.

### PayPal

În developer.paypal.com, la Apps & Credentials, creați o aplicație REST și luați Client ID și Secret (`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`). Cu `PAYPAL_ENV=sandbox` se lucrează cu conturi de probă; cu `PAYPAL_ENV=live`, cu bani adevărați. PayPal încasează în moneda din `PAYPAL_CURRENCY` (implicit EUR); dacă site-ul are prețurile în lei, suma se împarte la cursul din panou.

### SMS / plata pe factura de telefon

Pentru SMS aveți nevoie de un contract cu un agregator (firma care are numerele scurte la operatori). De la el primiți numărul scurt, eventual un cuvânt-cheie și tariful. Apoi:

1. Puneți un text lung, la întâmplare, în `SMS_HOOK_SECRET` și reporniți serverul.
2. Dați agregatorului adresa `https://domeniul-dvs/api/hook/sms/<valoarea din SMS_HOOK_SECRET>`. El o apelează (GET sau POST) la fiecare SMS primit.
3. În panou, la „Tarifele de SMS”, completați numărul scurt, cuvântul-cheie și costul pentru fiecare produs, apoi porniți metoda.

Cum merge: pagina de plată îi arată clientului un cod de 6 caractere (de exemplu `CINE K7M2QX` la 7415). Când agregatorul ne trimite mesajul, serverul caută comanda după cod, verifică numărul scurt și cuvântul-cheie și deblochează. Răspunsul serverului este textul SMS-ului de confirmare.

- Serverul înțelege textul mesajului din câmpurile `message`, `text`, `msg`, `body`, `content` sau `sms` și numărul scurt din `shortcode`, `short_code`, `to`, `number`, `destination` sau `receiver`. Dacă agregatorul folosește alte nume, le dați prin `SMS_TEXT_PARAM` și `SMS_NUMBER_PARAM`. Dacă trimite și apeluri pentru mesaje nefacturate, dați câmpul de stare și valoarea bună prin `SMS_STATUS_PARAM` și `SMS_STATUS_OK`.
- `SMS_HOOK_IPS` (opțional) lasă doar adresele IP ale agregatorului să apeleze.
- Un SMS are preț fix. De aceea SMS-ul apare ca metodă doar când clientul cumpără un singur produs, fără cod de reducere. Două produse cu tarife diferite au nevoie de numere scurte sau cuvinte-cheie diferite.
- Codul din SMS este valabil două zile.
- Formatul exact al apelului diferă de la un agregator la altul. Partea aceasta a fost probată doar cu un agregator simulat; după ce alegeți agregatorul, poate fi nevoie de o mică potrivire.
- Plata pe factură fără SMS (clientul confirmă pe o pagină a operatorului) nu este inclusă: se face după specificația agregatorului ales.

### De știut

- Înapoierea banilor se face din contul Stripe sau PayPal. Site-ul nu retrage singur accesul.
- La „Cifre și comenzi”, „încasări din plăți reale” adună prețurile de pe site. La SMS și PayPal, suma care vă ajunge efectiv este cea din contractul cu agregatorul, respectiv suma în euro.
- Regulile fiecărui procesator despre ce are voie să vândă un site (de exemplu tarotul) și partea de taxe și TVA trebuie verificate cu procesatorul și cu un contabil înainte de lansare.

### Încercarea plăților fără niciun cont

```bash
node tools/plati-simulate.js
```

Pornește site-ul la `http://localhost:5182` (cu datele din `data-test/`) împreună cu un „Stripe”, un „PayPal” și un „telefon” simulate pe calculatorul dumneavoastră. Alegeți „Reale” în panou și treceți prin toată plata; nu se ia niciun ban. Telefonul simulat: `http://127.0.0.1:5187/sms`.

Probele automate (pornesc singure serverul, pe foldere de date separate, pe care le șterg la sfârșit):

```bash
npm test
```

## Setările serverului

Se dau prin variabile de mediu. Portul, folderul de date și adresa de ascultare se pot da și ca argumente.

| Variabilă | Argument | Implicit | Ce face |
| --- | --- | --- | --- |
| `PORT` | `--port=` | `5180` | Portul pe care ascultă serverul. |
| `DATA_DIR` | `--data=` | `data` | Folderul cu datele salvate. |
| `HOST` | `--host=` | `0.0.0.0` | Adresa pe care ascultă. |
| `TRUST_PROXY` | | `false` | Puneți `true` când serverul stă în spatele nginx sau Caddy, ca să vadă IP-ul real și HTTPS-ul. |
| `COOKIE_SECURE` | | `auto` | Cu `auto`, cookie-ul de sesiune devine `Secure` ori de câte ori cererea vine prin HTTPS. |
| `SESSION_IDLE_HOURS` | | `8` | După câte ore fără activitate expiră sesiunea din panou. |
| `SESSION_MAX_DAYS` | | `7` | Durata maximă a unei sesiuni. |
| `HISTORY_KEEP` | | `30` | Câte versiuni salvate se păstrează. |
| `RETENTION_DAYS` | | `365` | După câte zile fără vizită se șterg singure răspunsurile unui vizitator. |
| `PUBLIC_URL` | | adresa din browser | Adresa publică a site-ului (`https://exemplu.ro`). La ea este întors clientul după plată. |
| `STRIPE_SECRET_KEY` | | | Cheia secretă Stripe. Fără ea, plata cu cardul nu apare în starea „Reale”. |
| `STRIPE_WEBHOOK_SECRET` | | | Secretul de semnare al webhook-ului Stripe. |
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | | | Cheile aplicației PayPal. |
| `PAYPAL_ENV` | | `sandbox` | `sandbox` pentru probe, `live` pentru bani adevărați. |
| `PAYPAL_CURRENCY` | | `EUR` | Moneda în care încasează PayPal. |
| `SMS_HOOK_SECRET` | | | Secretul din adresa pe care o apelează agregatorul de SMS. |
| `SMS_HOOK_IPS` | | | Opțional: adresele IP ale agregatorului, despărțite prin virgulă. |
| `SMS_TEXT_PARAM`, `SMS_NUMBER_PARAM`, `SMS_STATUS_PARAM`, `SMS_STATUS_OK` | | | Opțional: numele câmpurilor trimise de agregator, dacă diferă de cele obișnuite. |

Exemplu:

```bash
node server/server.js --port=8080 --data=/var/lib/cupidon
```

Pe internet, site-ul trebuie servit prin HTTPS (nginx sau Caddy în față, cu `TRUST_PROXY=true`).

## Unde stau lucrurile

```
public/            tot ce vede browserul (doar acest folder se servește)
  index.html       site-ul
  admin.html       panoul
  js/content.js    valorile implicite: texte, prețuri, setări
  js/app.js        site-ul
  js/admin.js      panoul
  css/             culori, fonturi, așezare
server/
  server.js        serverul
  tests.js         valorile implicite private: întrebări, răspunsuri corecte, texte de rezultat
  scoring.js       calculul scorurilor
  people.js        vizitatori, comenzi, coduri promo
  pay.js           plățile: Stripe, PayPal, SMS
  manage.js        comenzile pentru cont
tools/             probe automate, site-ul cu plăți simulate și varianta de demo (nu se servesc)
docs/              biblioteca de întrebări, așa cum a fost primită (nu se servește)
dist/              demo-ul făcut cu `npm run demo` (se reface oricând; nu se pune în git)
data/              datele salvate (apare la prima pornire; nu se pune în git)
```

- Valorile implicite stau în `public/js/content.js` și `server/tests.js`. Panoul nu scrie în ele: salvează în `data/site.json`, iar site-ul aplică ce s-a salvat peste valorile implicite.
- Întrebările și răspunsurile corecte nu ajung niciodată întregi în browser. Scorul se calculează pe server.
- Dacă schimbați de mână `content.js` sau `tests.js`, reporniți serverul.
- Dacă folderul `public/` ajunge pe o găzduire simplă, fără acest server, paginile se văd cu valorile implicite, dar testele nu pornesc (întrebările stau pe server). Pentru o astfel de găzduire există varianta de demo, mai jos.

### Folderul `data/`

Păstrați-l în siguranță și faceți-i copii: conține contul de administrare, conținutul salvat și versiunile lui, codurile promo, comenzile, răspunsurile vizitatorilor și jurnalul. Nu se servește niciodată pe web.

## Vizitatorii și datele lor

- Nu există conturi. Fiecare vizitator primește un link privat („Linkul meu”), cu care își regăsește rezultatele de pe orice dispozitiv.
- Adresa de e-mail este opțională și se păstrează doar cu acord. Site-ul nu trimite singur e-mailuri; adresele se descarcă din Setări.
- Din „Linkul meu”, oricine își poate șterge toate datele. Dacă făcea parte dintr-un test de cuplu, dispare și acela, pentru amândoi.

## Securitate, pe scurt

- Parole: hash scrypt cu salt.
- Sesiune: token aleator în cookie `HttpOnly`, `SameSite=Strict`; pe server se ține doar hash-ul lui.
- Orice modificare cere sesiune validă, token CSRF și o cerere de pe același domeniu.
- După 5 parole greșite, contul și IP-ul se blochează 15 minute; blocarea se dublează la fiecare greșeală în plus.
- Serverul verifică tot ce primește, iar site-ul afișează textele din panou doar ca text, niciodată ca HTML.
- Scrierile pe disc sunt atomice (fișier temporar, apoi redenumire).

## Probe pe calculatorul propriu

`.claude/launch.json` pornește serverul pe portul 5181 cu folderul `data-test/`, separat de datele reale:

```bash
node server/server.js --data=data-test --port=5181
```

Contul de test pentru acest folder este notat în `data-test/cont-de-test.txt`. Nu îl folosiți pe site-ul real.
Probele automate (`npm test`) nu ating `data-test/`: lucrează în foldere proprii (`data-smoke…`).

## Demo fără server (pentru demo.iluz.ro)

```bash
npm run demo
```

Comanda face `dist/cupidon-demo.zip` (și folderul `dist/demo/`, cu același conținut). Arhiva se încarcă așa cum e pe demo.iluz.ro, ca demo de tip „site”: are `index.html` sus și nu cere niciun server.

Cum merge: serverul este împachetat într-un fișier care rulează în browser (`js/demo-server.js`), iar datele se țin în browserul fiecărui vizitator. Înainte să scrie arhiva, comanda probează singură demo-ul: un test, o plată de probă și o salvare din panou.

Ce e altfel față de site-ul real:

- **Totul rămâne în browserul vizitatorului.** Nimic nu ajunge la dumneavoastră: nici răspunsuri, nici adrese de e-mail, nici comenzi. Fiecare vizitator vede propriul demo.
- **Plățile sunt doar de probă.** Stripe, PayPal și SMS-ul real cer serverul.
- **Testul de cuplu se face dintr-un singur browser.** Bara de sus are „Treci la persoana 2”: așa răspundeți și în locul partenerului. Linkul de invitație trimis pe alt telefon nu merge în demo.
- **Panoul se deschide fără parolă** (același gest ascuns: tastați „admin” sau atingeți de 5 ori semnul ©). Ce salvați acolo se vede doar în browserul dumneavoastră.
- **„Ia-o de la capăt”**, din bara de sus, șterge tot ce s-a făcut în demo în acel browser.
- **Întrebările și răspunsurile corecte ajung în browser.** De aceea demo-ul se dă doar pe link privat și nu se pune niciodată pe adresa publică a site-ului.

Ca să îl vedeți pe calculator înainte de încărcare: `node tools/build-demo.js --serve=5183`, apoi deschideți http://localhost:5183/. După orice schimbare în site, rulați din nou `npm run demo` și încărcați arhiva nouă.

## De știut înainte de lansare

- Textele din „Confidențialitate” și „Termeni” sunt ciorne. Trebuie citite de cineva care se pricepe.
- Întrebările vin din biblioteca de întrebări a site-ului (`docs/biblioteca-intrebari.csv`, modulele M1–M6). Sunt scrise pentru acest site și nu sunt validate ca instrument psihologic. Rândurile FREE, COUPLE și FRIEND din bibliotecă nu sunt încă folosite pe site.
- La „IQ orientativ”, după cele 30 de întrebări ușoare din bibliotecă urmează 30 mai grele. Fără ele, aproape oricine ar primi intervalul cel mai mare. Se pot scoate din panou, la Teste.
- La „Latura ta ascunsă”, un scor mare înseamnă „mai mult din trăsătură”. Bifa „Afirmație inversă” de la fiecare întrebare (panou, Teste) spune în ce direcție trage întrebarea.
- „IQ orientativ” dă un interval estimativ, nu un IQ măsurat clinic.
- Fonturile se încarcă de la Google Fonts.
