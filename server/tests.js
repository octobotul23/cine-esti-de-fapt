// Valorile implicite ale testelor: întrebări, chei de răspuns, texte de raport, cărți de tarot.
// Fișierul nu se servește niciodată în browser. Tot ce e aici se poate schimba din panou (/admin → Teste).
//
// Sursa întrebărilor: biblioteca de întrebări a site-ului (docs/biblioteca-intrebari.csv, modulele M1–M6).
// Sunt întrebări scrise pentru acest site, nu instrumente psihometrice etalonate.
// La „IQ orientativ”, după cele 30 de întrebări din bibliotecă urmează 30 mai grele, scrise tot pentru acest site.
// Testul rapid („quick”) folosește cele 10 rânduri FREE din aceeași bibliotecă.

// Rând compact → întrebare cu scală de acord. sign: 1 = acordul crește scorul, -1 = îl scade.
function likert(prefix, free, rows) {
  return rows.map(([dim, sign, text], i) => ({ id: prefix + String(i + 1).padStart(2, "0"), text, dim, rev: sign < 0, free: i < free }));
}
// Rând compact → întrebare cu un singur răspuns corect (index în „options”).
function quiz(prefix, rows) {
  return rows.map(([area, free, text, options, correct, explain], i) => ({ id: prefix + String(i + 1).padStart(2, "0"), text, options, correct, area, free: !!free, explain }));
}
// Rând compact → întrebare pentru testul de cuplu (fără răspuns corect).
function pick(prefix, rows) {
  return rows.map(([cat, free, text, options], i) => ({ id: prefix + String(i + 1).padStart(2, "0"), text, options, cat, free: !!free }));
}
function dim(id, name, area, strength, desc, low, mid, high, tip, forte, provocare) {
  return { id, name, area, strength, desc, low, mid, high, tip, forte, provocare };
}

const TESTS = {
  // Cele cinci trepte de răspuns la întrebările cu scală.
  scale: ["Deloc adevărat", "Mai degrabă fals", "Nici da, nici nu", "Mai degrabă adevărat", "Foarte adevărat"],
  // Sub „low” scorul e mic, de la „high” în sus e mare (0–100).
  levels: { low: 40, high: 60 },

  modules: {
    bigfive: {
      type: "likert",
      dims: [
        dim("E", "Sociabilitate", "munca", true, "Câtă energie îți iei din contactul cu oamenii.",
          "Îți încarci bateriile în liniște. Preferi discuțiile în doi unui grup mare și alegi cu grijă cui îi dai timpul tău.",
          "Te simți bine și între oameni, și în liniște. Vorbești mult într-un grup cunoscut și mai puțin într-unul nou.",
          "Oamenii îți dau energie. Începi ușor o conversație și te simți în largul tău când ești în centrul atenției.",
          "Dacă vrei mai multă ușurință între oameni, începe cu un pas mic: pune o întrebare unui necunoscut o dată pe zi.",
          "Legi ușor conversații și aduci energie într-un grup.",
          "Începe tu o conversație cu cineva cu care nu vorbești de obicei."),
        dim("A", "Cooperare", "relatii", true, "Cât de mult ții cont de ceilalți.",
          "Spui lucrurilor pe nume și îți aperi interesul. Nu te lași ușor convins doar ca să fie liniște.",
          "Ții cont de ceilalți, dar nu cu orice preț. Știi când să cedezi și când să rămâi pe poziție.",
          "Simți repede ce simt ceilalți și îi ajuți fără să ți se ceară. Oamenii se simt în siguranță lângă tine.",
          "Empatia merge mai bine împreună cu limite clare. Înainte să spui „da”, întreabă-te dacă ai și tu loc pentru asta.",
          "Îi înțelegi pe ceilalți și construiești încredere.",
          "Ajută pe cineva fără să ți se ceară și fără să aștepți ceva înapoi."),
        dim("C", "Organizare", "munca", true, "Cât de bine îți organizezi lucrurile și cât ții de ele.",
          "Mergi mai mult după inspirație decât după plan. Te adaptezi ușor, dar lucrurile plictisitoare rămân des pe mâine.",
          "Pui ordine unde contează și lași restul mai liber. Termini ce e important, chiar dacă nu mereu din timp.",
          "Îți faci un plan și te ții de el. Vezi detaliile și lumea se poate baza pe cuvântul tău.",
          "Alege în fiecare dimineață trei lucruri de terminat. Seara verifică doar câte ai închis.",
          "Duci lucrurile la capăt și vezi detaliile.",
          "Termină azi un lucru pe care îl tot amâni."),
        dim("S", "Stabilitate emoțională", "", true, "Cât de ușor îți păstrezi echilibrul.",
          "Simți lucrurile intens și stresul ajunge repede la tine. Asta te ajută să vezi ce nu merge, dar te și obosește.",
          "De obicei îți păstrezi echilibrul, dar zilele grele se văd. Îți revii într-un timp rezonabil.",
          "Îți păstrezi calmul când alții se agită. Grijile nu te țin treaz și treci repede peste supărări.",
          "Notează ce anume îți strică starea într-o săptămână. Tiparul se vede repede, iar ce vezi poți schimba.",
          "Îți păstrezi calmul când lucrurile se complică.",
          "Când simți că te enervezi, numără până la zece înainte să răspunzi."),
        dim("O", "Deschidere", "munca", true, "Cât de mult te atrag ideile și lucrurile noi.",
          "Preferi ce e verificat și concret. Nu pierzi vremea cu teorii și știi exact ce îți place.",
          "Ai curiozitate, dar rămâi cu picioarele pe pământ. Încerci lucruri noi când au un rost clar.",
          "Ai multe idei și imaginație bogată. Te plictisesc rutina și răspunsurile de-a gata.",
          "Alege o idee din cele multe și du-o până la un rezultat mic, pe care îl poți arăta cuiva.",
          "Vii cu idei noi și înveți repede.",
          "Încearcă azi ceva ce nu ai mai făcut: un drum nou, o mâncare nouă, un subiect nou.")
      ],
      // Primele 10 (câte două pe trăsătură) formează varianta gratuită.
      // „Stabilitate emoțională” este „Reactivitate emoțională” din bibliotecă, întoarsă: scor mare = mai mult calm.
      questions: likert("bf", 10, [
        ["O", 1, "Îmi place să încerc activități pe care nu le-am mai făcut."], ["C", 1, "Îmi fac un plan înainte de o zi aglomerată."],
        ["E", 1, "Mă simt bine când cunosc oameni noi."], ["A", 1, "Încerc să înțeleg de ce cineva vede lucrurile diferit."],
        ["S", -1, "Mă îngrijorez mult înaintea unor evenimente importante."], ["O", 1, "Mă atrag ideile diferite de ale mele."],
        ["C", 1, "Termin ce încep chiar dacă devine plictisitor."], ["E", 1, "Îmi place să vorbesc în grupuri mari."],
        ["A", 1, "Îi ajut pe ceilalți când pot, fără să aștept ceva în schimb."], ["S", -1, "Îmi este greu să mă liniștesc după o ceartă."],
        ["O", 1, "Îmi place să aflu cum funcționează lucrurile."], ["C", 1, "Îmi respect termenele pe care le promit."],
        ["E", 1, "Mă energizează întâlnirile cu prietenii."], ["A", 1, "Caut o soluție bună pentru ambele părți într-un conflict."],
        ["S", -1, "Mă afectează criticile mai mult decât mi-aș dori."], ["O", 1, "Mă plictisesc repede când totul se repetă."],
        ["C", 1, "Îmi țin lucrurile importante într-o ordine utilă."], ["E", 1, "Într-un grup nou, de obicei încep eu conversația."],
        ["A", 1, "Îmi pasă dacă vorbele mele rănesc pe cineva."], ["S", -1, "Mă gândesc des la ce ar putea merge prost."],
        ["O", 1, "Caut explicații înainte să trag o concluzie."], ["C", -1, "Amân frecvent lucruri importante până în ultimul moment."],
        ["E", -1, "Prefer să petrec cea mai mare parte a timpului liber singur."], ["A", -1, "Îmi este greu să recunosc când am greșit."],
        ["S", 1, "Rămân calm când planurile se schimbă brusc."], ["O", 1, "Îmi place să inventez soluții noi."],
        ["C", 1, "Îmi verific munca înainte să o predau."], ["E", 1, "Îmi exprim ușor ideile în fața altora."],
        ["A", 1, "Ascult până la capăt înainte să răspund."], ["S", -1, "Uneori o problemă mică îmi strică toată ziua."],
        ["O", -1, "Prefer mereu o metodă cunoscută, chiar dacă există alternative."], ["C", 1, "Mă țin de obiceiurile pe care mi le propun."],
        ["E", 1, "Îmi place să particip la activități de grup."], ["A", 1, "Îmi țin promisiunile față de prieteni."],
        ["S", 1, "Îmi revin repede după o dezamăgire."], ["O", 1, "Mă bucur să descopăr locuri și culturi noi."],
        ["C", -1, "Îmi este greu să stabilesc priorități."], ["E", -1, "După o întâlnire socială am nevoie de mult timp singur."],
        ["A", -1, "Prefer să câștig o dispută chiar dacă stric relația."], ["S", -1, "Când am multe sarcini mă simt repede copleșit."],
        ["O", 1, "Îmi place să discut despre idei neobișnuite."], ["C", 1, "Îmi împart sarcinile mari în pași mici."],
        ["E", 1, "Mă simt confortabil în centrul atenției."], ["A", 1, "Observ când cineva din jur are nevoie de ajutor."],
        ["S", 1, "Mă simt relaxat în majoritatea zilelor."], ["O", -1, "Rareori mă interesează să învăț ceva nou."],
        ["C", -1, "Mă bazez doar pe noroc când am ceva important de făcut."], ["E", -1, "Evit conversațiile chiar și când aș avea ceva de spus."],
        ["A", -1, "Nu mă interesează cum se simt ceilalți după o ceartă."], ["S", -1, "Îmi este greu să opresc gândurile care mă îngrijorează."]
      ])
    },

    iq: {
      type: "quiz",
      areas: [
        { id: "serii", name: "Serii numerice" }, { id: "calcul", name: "Calcul practic" }, { id: "logica", name: "Logică" },
        { id: "tipare", name: "Tipare" }, { id: "prob", name: "Probabilitate" }, { id: "verbal", name: "Cuvinte" }
      ],
      // De la ce procent de răspunsuri corecte în sus se afișează fiecare interval. Estimare, nu etalonare.
      bands: [
        { min: 0, lo: 75, hi: 85 }, { min: 20, lo: 85, hi: 95 }, { min: 40, lo: 95, hi: 105 },
        { min: 55, lo: 105, hi: 115 }, { min: 70, lo: 115, hi: 125 }, { min: 85, lo: 125, hi: 135 }
      ],
      // Primele 30 sunt ușoare (primele 10 sunt gratuite), ultimele 30 sunt mai grele.
      // Cine le știe doar pe cele ușoare ajunge pe la jumătate, adică în intervalul de mijloc.
      questions: quiz("iq", [
        ["serii", 1, "Ce număr urmează: 2, 4, 8, 16, ...?", ["24", "30", "32", "36"], 2, "Fiecare număr se dublează."],
        ["calcul", 1, "Un produs de 100 lei are reducere de 25%. Cât costă?", ["65 lei", "75 lei", "80 lei", "85 lei"], 1, "25% din 100 este 25."],
        ["logica", 1, "Toți trandafirii sunt flori. Ce știm sigur?", ["Toate florile sunt trandafiri", "Niciun trandafir nu e floare", "Toți trandafirii sunt flori", "Florile sunt roșii"], 2, "Este exact informația dată."],
        ["tipare", 1, "Ce literă urmează: A, C, E, G, ...?", ["H", "I", "J", "K"], 1, "Sărim câte o literă."],
        ["prob", 1, "Arunci o monedă corectă. Ce șansă ai să obții cap?", ["1 din 4", "1 din 2", "3 din 4", "Sigur"], 1, "Sunt două rezultate la fel de probabile."],
        ["calcul", 1, "Trei persoane împart egal 150 lei. Cât plătește fiecare?", ["30", "40", "50", "60"], 2, "150 împărțit la 3 = 50."],
        ["serii", 1, "Ce număr urmează: 5, 10, 15, 20, ...?", ["22", "25", "30", "35"], 1, "Adăugăm 5."],
        ["logica", 1, "Dacă plouă, strada se udă. Strada este uscată. Ce rezultă, presupunând regula adevărată?", ["A plouat", "Nu a plouat", "A nins sigur", "Nu putem spune nimic"], 1, "Dacă ar fi plouat, strada ar fi udă."],
        ["calcul", 1, "Un bilet costă 40 lei. Cât costă 3 bilete?", ["80", "100", "120", "140"], 2, "40 × 3 = 120."],
        ["tipare", 1, "Care cuvânt nu se potrivește?", ["Măr", "Pară", "Morcov", "Prună"], 2, "Morcovul este legumă în clasificarea culinară uzuală."],
        ["serii", 0, "Ce număr urmează: 1, 4, 9, 16, ...?", ["20", "24", "25", "36"], 2, "Pătratele numerelor 1,2,3,4,5."],
        ["calcul", 0, "Ai 200 lei și cheltuiești 60 lei. Cât îți rămâne?", ["120", "130", "140", "160"], 2, "200−60=140."],
        ["logica", 0, "Niciun câine nu este pisică. Rex este câine. Ce știm?", ["Rex este pisică", "Rex nu este pisică", "Rex este mic", "Rex este negru"], 1, "Aplicăm regula generală."],
        ["prob", 0, "Într-o pungă sunt 3 bile roșii și 1 albastră. Care culoare este mai probabilă la o extragere?", ["Albastră", "La fel", "Roșie", "Imposibil de spus"], 2, "3 bile roșii din 4."],
        ["tipare", 0, "Ce urmează: luni, miercuri, vineri, ...?", ["Sâmbătă", "Duminică", "Marți", "Joi"], 1, "Sărim o zi de fiecare dată."],
        ["calcul", 0, "Un drum de 120 km este parcurs în 2 ore. Viteza medie?", ["40 km/h", "50 km/h", "60 km/h", "80 km/h"], 2, "120 ÷ 2 = 60."],
        ["serii", 0, "Ce număr urmează: 3, 6, 12, 24, ...?", ["36", "42", "48", "54"], 2, "Dublăm."],
        ["logica", 0, "Ana este mai înaltă decât Bogdan. Bogdan este mai înalt decât Carmen. Cine este cel mai înalt?", ["Ana", "Bogdan", "Carmen", "Nu știm"], 0, "Ordinea este Ana, Bogdan, Carmen."],
        ["calcul", 0, "Cumperi 2 caiete la 7 lei fiecare. Primești rest 6 lei. Cât ai dat la casă?", ["10 lei", "15 lei", "20 lei", "25 lei"], 2, "Cost 14 lei + rest 6 = 20."],
        ["tipare", 0, "Ce număr lipsește: 2, 5, 8, __, 14?", ["9", "10", "11", "12"], 2, "Creștem cu 3."],
        ["prob", 0, "Arunci un zar corect. Care e probabilitatea să obții 6?", ["1/2", "1/3", "1/6", "1/12"], 2, "Un rezultat favorabil din șase."],
        ["calcul", 0, "Un produs de 80 lei se scumpește cu 10%. Noul preț?", ["84 lei", "86 lei", "88 lei", "90 lei"], 2, "10% din 80 este 8."],
        ["serii", 0, "Ce număr urmează: 100, 90, 80, 70, ...?", ["65", "60", "55", "50"], 1, "Scădem 10."],
        ["logica", 0, "Toate păsările din acest desen sunt albastre. Una este o pasăre din desen. Ce culoare are?", ["Verde", "Roșie", "Albastră", "Nu știm"], 2, "Conform regulii, toate sunt albastre."],
        ["tipare", 0, "Ce simbol urmează: ● ▲ ● ▲ ● ...?", ["●", "▲", "■", "◆"], 1, "Alternanță între cerc și triunghi."],
        ["calcul", 0, "Un film începe la 18:30 și durează 90 minute. Când se termină?", ["19:30", "19:45", "20:00", "20:30"], 2, "90 minute = o oră și jumătate."],
        ["serii", 0, "Ce număr urmează: 1, 2, 4, 7, 11, ...?", ["14", "15", "16", "17"], 2, "Diferențele sunt 1,2,3,4,5."],
        ["logica", 0, "Dacă toate A sunt B, iar toate B sunt C, ce știm sigur?", ["Toate C sunt A", "Toate A sunt C", "Niciun A nu e C", "Niciun B nu e C"], 1, "Relația este tranzitivă."],
        ["prob", 0, "Într-o cutie sunt 2 bile albe și 2 negre. Extragi una. Care este șansa să fie albă?", ["1/4", "1/2", "3/4", "1"], 1, "Două din patru."],
        ["calcul", 0, "Ai economisit 15 lei pe zi timp de 4 zile. Cât ai strâns?", ["45", "50", "60", "75"], 2, "15 × 4 = 60."],
        ["serii", 0, "Ce număr urmează? 2, 6, 12, 20, 30, …", ["36", "40", "42", "44"], 2, "Diferențele cresc cu 2: 4, 6, 8, 10, apoi 12. 30 + 12 = 42."],
        ["calcul", 0, "Un tricou costă 80 de lei după o reducere de 20%. Cât costa înainte?", ["96 de lei", "100 de lei", "104 lei", "120 de lei"], 1, "80 de lei înseamnă 80% din prețul vechi, deci prețul vechi era 100 de lei."],
        ["logica", 0, "Maria este mai rapidă decât Ioana. Ioana este mai rapidă decât Elena. Paul este mai rapid decât Maria. Cine este cel mai lent?", ["Maria", "Ioana", "Elena", "Paul"], 2, "Ordinea este Paul, Maria, Ioana, Elena."],
        ["verbal", 0, "Carte este pentru bibliotecă ce este tablou pentru…", ["pictor", "galerie", "ramă", "culoare"], 1, "Cărțile se păstrează în bibliotecă, tablourile în galerie."],
        ["tipare", 0, "Ce literă urmează? B, E, H, K, …", ["L", "M", "N", "O"], 2, "Se sare câte două litere: B, E, H, K, N."],
        ["calcul", 0, "Media a cinci numere este 12. Patru dintre ele sunt 10, 14, 9 și 15. Care este al cincilea?", ["10", "11", "12", "13"], 2, "Suma trebuie să fie 60. Cele patru numere dau 48, deci lipsește 12."],
        ["logica", 0, "Dacă plouă, strada e udă. Strada e udă. Ce poți spune sigur?", ["A plouat.", "Nu a plouat.", "Nu se poate ști sigur dacă a plouat.", "Strada e mereu udă."], 2, "Strada poate fi udă și din alt motiv, deci nu rezultă că a plouat."],
        ["verbal", 0, "Care cuvânt nu se potrivește cu celelalte?", ["vioară", "chitară", "flaut", "violoncel"], 2, "Flautul este instrument de suflat, celelalte au coarde."],
        ["serii", 0, "Ce număr urmează? 1, 1, 2, 3, 5, 8, …", ["11", "12", "13", "15"], 2, "Fiecare număr este suma celor două dinaintea lui: 5 + 8 = 13."],
        ["calcul", 0, "Trei muncitori termină o lucrare în 12 zile. În câte zile o termină patru muncitori, în același ritm?", ["8", "9", "10", "16"], 1, "Lucrarea cere 36 de zile de muncă. Împărțite la patru muncitori, ies 9 zile."],
        ["logica", 0, "Într-o familie sunt patru frați. Fiecare frate are o soră. Câți copii sunt, cel puțin, în familie?", ["4", "5", "6", "8"], 1, "Ajunge o singură soră pentru toți cei patru frați: 5 copii."],
        ["verbal", 0, "Cald este pentru fierbinte ce este rece pentru…", ["răcoros", "înghețat", "călduț", "umed"], 1, "Fierbinte înseamnă foarte cald, înghețat înseamnă foarte rece."],
        ["serii", 0, "Ce număr urmează? 81, 27, 9, 3, …", ["0", "1", "2", "6"], 1, "Fiecare număr se împarte la 3."],
        ["calcul", 0, "Un tren parcurge 150 km în o oră și 15 minute. Care este viteza lui medie?", ["100 km/h", "112,5 km/h", "120 km/h", "125 km/h"], 2, "O oră și 15 minute înseamnă 1,25 ore. 150 : 1,25 = 120."],
        ["logica", 0, "Toți pictorii din club sunt stângaci. Unii stângaci din oraș cântă la pian. Ce rezultă obligatoriu?", ["Unii pictori din club cântă la pian.", "Toți cei care cântă la pian sunt pictori.", "Niciun pictor din club nu cântă la pian.", "Niciuna dintre concluziile de mai sus."], 3, "Stângacii care cântă la pian pot fi alții decât pictorii din club, deci nu rezultă nimic sigur."],
        ["verbal", 0, "Ce cuvânt are sensul cel mai apropiat de „efemer”?", ["veșnic", "trecător", "fragil", "rar"], 1, "Efemer înseamnă care durează puțin."],
        ["serii", 0, "Ce număr urmează? 4, 9, 19, 39, …", ["59", "69", "78", "79"], 3, "Fiecare număr se dublează și se adaugă 1: 39 × 2 + 1 = 79."],
        ["calcul", 0, "Ana are de două ori vârsta lui Radu și este cu 6 ani mai mare decât el. Câți ani are Ana?", ["8", "10", "12", "18"], 2, "Radu are 6 ani, iar Ana de două ori pe atât: 12."],
        ["logica", 0, "Ai trei cutii: una doar cu mere, una doar cu pere și una cu amestec. Toate etichetele sunt greșite. Scoți un fruct din cutia pe care scrie „amestec” și este un măr. Ce conține cutia pe care scrie „pere”?", ["Doar mere", "Doar pere", "Amestec", "Nu se poate ști"], 2, "Cutia „amestec” are de fapt doar mere. Cutia „pere” nu poate avea pere, iar merele sunt luate, deci are amestec."],
        ["verbal", 0, "Ce cuvânt este opusul lui „a amplifica”?", ["a mări", "a diminua", "a repeta", "a ascunde"], 1, "A amplifica înseamnă a mări, opusul este a diminua."],
        ["serii", 0, "Ce număr urmează? 2, 3, 5, 9, 17, …", ["25", "31", "33", "34"], 2, "Diferențele se dublează: 1, 2, 4, 8, apoi 16. 17 + 16 = 33."],
        ["calcul", 0, "Câte numere de la 1 la 50 se împart exact la 3 sau la 5?", ["21", "23", "26", "29"], 1, "16 se împart la 3, 10 la 5, iar 3 dintre ele (15, 30, 45) sunt numărate de două ori: 16 + 10 − 3 = 23."],
        ["logica", 0, "Cinci prieteni stau la rând. Filip este primul, Gabi este ultima. Dan nu este nici primul, nici ultimul. Ema stă imediat după Dan. Horia stă înaintea lui Dan. Pe ce loc stă Horia?", ["Al doilea", "Al treilea", "Al patrulea", "Nu se poate ști"], 0, "Rândul este Filip, Horia, Dan, Ema, Gabi."],
        ["verbal", 0, "Sculptor este pentru daltă ce este chirurg pentru…", ["spital", "pacient", "bisturiu", "operație"], 2, "Dalta este unealta sculptorului, bisturiul este unealta chirurgului."],
        ["tipare", 0, "Ce pereche urmează? AZ, BY, CX, …", ["DV", "DW", "EW", "DX"], 1, "Prima literă merge înainte în alfabet, a doua înapoi: DW."],
        ["prob", 0, "Arunci două zaruri. Care este probabilitatea ca suma lor să fie 7?", ["1 din 12", "1 din 9", "1 din 6", "1 din 4"], 2, "Din 36 de combinații, 6 dau suma 7: 6 din 36 înseamnă 1 din 6."],
        ["logica", 0, "Un ceas rămâne în urmă cu 5 minute în fiecare oră. Îl potrivești la 12:00. Ce oră arată când ora reală este 18:00?", ["17:25", "17:30", "17:35", "18:30"], 1, "În 6 ore pierde 30 de minute, deci arată 17:30."],
        ["verbal", 0, "„Niciun câștig fără efort.” Care afirmație spune același lucru?", ["Orice efort aduce câștig.", "Dacă ai câștigat, ai depus efort.", "Dacă ai depus efort, ai câștigat.", "Câștigul vine fără efort."], 1, "Propoziția spune că nu există câștig fără efort, adică orice câștig a cerut efort."],
        ["calcul", 0, "Pui 1.000 de lei la o dobândă de 10% pe an, iar dobânda se adaugă la sumă. Cât ai după doi ani?", ["1.100 de lei", "1.200 de lei", "1.210 lei", "1.221 de lei"], 2, "După primul an ai 1.100 de lei, iar 10% din 1.100 înseamnă încă 110."],
        ["logica", 0, "O vază s-a spart. Andrei spune: „Nu eu am spart-o.” Bianca spune: „Cristi a spart-o.” Cristi spune: „Bianca minte.” Doar unul dintre ei spune adevărul. Cine a spart vaza?", ["Andrei", "Bianca", "Cristi", "Nu se poate ști"], 0, "Dacă a spart-o Andrei, el și Bianca mint, iar Cristi spune adevărul: exact unul. În celelalte două cazuri ar spune adevărul doi copii."]
      ])
    },

    emotional: {
      type: "likert",
      dims: [
        dim("recunoastere", "Recunoașterea emoțiilor", "relatii", true, "Cât de bine știi ce simți și de ce.",
          "Îți dai seama mai greu ce simți și de unde vine. Uneori ești iritat fără să știi de ce.",
          "De obicei știi ce simți, dar cauza îți scapă câteodată.",
          "Știi ce simți și de ce. Observi repede când oboseala sau teama îți schimbă starea.",
          "Seara, răspunde în scris la o singură întrebare: „Ce am simțit cel mai tare azi și când?”",
          "Știi ce simți și de ce.",
          "Oprește-te de trei ori azi și întreabă-te: „Ce simt acum?”"),
        dim("reglare", "Reglare emoțională", "relatii", true, "Ce faci cu o emoție puternică după ce a apărut.",
          "Emoțiile puternice te iau pe sus. La nervi spui lucruri pe care le regreți și îți trebuie timp ca să te aduni.",
          "De cele mai multe ori îți stăpânești reacțiile. Îți scapă doar lucrurile care te ating cu adevărat.",
          "Simți emoția, dar tu alegi ce faci cu ea. Poți lua o pauză și poți amâna discuția până te liniștești.",
          "Dă emoției un nume înainte să reacționezi: „simt furie”, „simt dezamăgire”. Numele îi ia din putere.",
          "Alegi cum reacționezi, chiar și la emoții puternice.",
          "Azi, înainte de un răspuns la nervi, respiră de trei ori."),
        dim("empatie", "Empatie", "relatii", true, "Cât de bine vezi ce simt ceilalți.",
          "Ești atent mai ales la fapte și la soluții. Ce simte celălalt îți scapă uneori, până nu ți se spune direct.",
          "Îți dai seama ce simt cei apropiați. Când ești pe fugă, mai ratezi câte un semn sau sari direct la sfaturi.",
          "Vezi repede când cineva nu e bine și întrebi înainte să presupui. Oamenii se simt ascultați lângă tine.",
          "Când cineva îți povestește o problemă, pune întâi o întrebare. Sfatul poate aștepta până la final.",
          "Vezi ce simt ceilalți și îi asculți până la capăt.",
          "Întreabă azi pe cineva „Cum ești, de fapt?” și ascultă fără să dai sfaturi."),
        dim("exprimare", "Comunicare emoțională", "relatii", true, "Cât de ușor spui ce simți și ce ai nevoie.",
          "Ții în tine ce te deranjează, până când se adună prea mult. Îți vine greu să ceri ajutor sau spațiu.",
          "Spui ce simți când miza e mare. Lucrurile mărunte le lași să treacă, iar unele se adună.",
          "Spui calm ce te-a deranjat și ce ai nevoie, fără să ataci omul din fața ta.",
          "Folosește o propoziție simplă: „Când s-a întâmplat asta, m-am simțit așa. Am nevoie de…”",
          "Spui calm ce simți și ce ai nevoie.",
          "Cere azi un lucru de care ai nevoie: ajutor, timp sau liniște."),
        dim("stres", "Gestionarea stresului", "munca", true, "Ce faci când se adună prea multe.",
          "Când se adună prea multe, te pierzi printre ele. Planurile și somnul tău sunt primele care au de suferit.",
          "Faci față stresului obișnuit. Perioadele lungi te obosesc și îți strică odihna.",
          "Știi ce te ajută: îți pui ziua în ordine, iei pauze și cauți primul pas pe care îl poți face.",
          "Împarte orice sarcină mare în pași de 20 de minute. Un pas mic terminat liniștește mai bine decât un plan mare.",
          "Îți păstrezi direcția când se adună multe.",
          "Ia azi o pauză de zece minute înainte să ajungi la capătul puterilor.")
      ],
      questions: likert("em", 10, [
        ["recunoastere", 1, "Îmi dau seama când sunt supărat, chiar dacă nu spun nimic."], ["reglare", 1, "Când mă enervez, pot face o pauză înainte să răspund."],
        ["empatie", 1, "Îmi dau seama când cineva apropiat nu se simte bine."], ["exprimare", 1, "Pot spune calm ce m-a deranjat."],
        ["stres", 1, "Îmi organizez ziua când am prea multe de făcut."], ["recunoastere", 1, "Pot numi emoția pe care o simt într-o zi grea."],
        ["reglare", 1, "După o ceartă, găsesc o cale să mă liniștesc."], ["empatie", 1, "Întreb înainte să presupun ce simte altcineva."],
        ["exprimare", -1, "Îmi este greu să cer ajutor când am nevoie."], ["stres", 1, "Știu ce activități mă ajută să mă relaxez."],
        ["recunoastere", 1, "Observ când oboseala îmi schimbă starea."], ["reglare", -1, "Spun lucruri pe care le regret când sunt furios."],
        ["empatie", 1, "Încerc să văd o problemă și din perspectiva celuilalt."], ["exprimare", 1, "Spun clar când am nevoie de spațiu."],
        ["stres", -1, "Stresul mă face să renunț repede la planuri."], ["recunoastere", 1, "Îmi dau seama când o problemă mă sperie."],
        ["reglare", 1, "Respir sau mă mișc puțin când simt tensiune."], ["empatie", -1, "Mă grăbesc să dau sfaturi fără să ascult."],
        ["exprimare", 1, "Pot asculta fără să întrerup când cineva este supărat."], ["stres", 1, "Îmi iau pauze când observ că sunt epuizat."],
        ["recunoastere", -1, "Uneori nu știu de ce sunt iritat."], ["reglare", -1, "Îmi ia mult să îmi revin după o critică."],
        ["empatie", 1, "Observ când o glumă îl rănește pe celălalt."], ["exprimare", -1, "Ascund ce simt până când izbucnesc."],
        ["stres", 1, "Când apar probleme, caut primul pas posibil."], ["recunoastere", 1, "Pot face diferența între tristețe și dezamăgire."],
        ["reglare", 1, "Pot amâna o discuție până mă calmez."], ["empatie", 1, "Pot accepta că două persoane simt diferit în aceeași situație."],
        ["exprimare", 1, "Încerc să discut o problemă fără să atac persoana."], ["stres", -1, "Îmi este greu să dorm când am griji."]
      ])
    },

    dark: {
      type: "likert",
      // Trăsături descrise neutru: aici nu există scor „bun” sau „rău”, deci nu intră la puncte forte.
      // Scor mare = mai mult din trăsătură (mai multă nevoie de apreciere, mai mult calcul, mai mult impuls).
      dims: [
        dim("apreciere", "Căutarea aprecierii", "", false, "Cât de mult contează pentru tine să fii văzut și apreciat.",
          "Nu ai nevoie de aplauze. Preferi ca munca să vorbească pentru tine și te bucuri ușor de reușitele altora.",
          "Aprecierea îți face plăcere, dar nu alergi după ea.",
          "Vrei ca reușitele tale să fie văzute și te doare când trec neobservate. Aprecierea celorlalți îți dă energie.",
          "Verifică din când în când: fac asta pentru că îmi place, sau ca să fiu văzut?",
          "Știi ce valoare ai și îți place să o arăți.",
          "Laudă azi pe cineva pentru ceva concret."),
        dim("strategie", "Strategii sociale", "", false, "Cât de mult calculezi ce spui și cum, ca să obții ce vrei.",
          "Joci cu cărțile pe față. Spui ce vrei, chiar dacă pierzi un avantaj.",
          "Mergi de obicei pe drumul drept, dar îți alegi momentul și cuvintele când miza e mare.",
          "Gândești cu câțiva pași înainte. Alegi ce spui, cui și când, ca să ajungi unde vrei.",
          "Strategia câștigă pe termen lung doar împreună cu încrederea. Întreabă-te: m-aș simți bine dacă celălalt ar ști exact ce urmăresc?",
          "Gândești cu câțiva pași înainte.",
          "Într-o discuție de azi, spune deschis ce urmărești."),
        dim("impuls", "Impulsivitate", "", false, "Cât de repede treci la fapte și cât cântărești urmările.",
          "Te gândești la urmări înainte să faci ceva. Îți asumi ce ai hotărât și repari ce ai greșit.",
          "De obicei cântărești înainte, dar la nervi sau la o ocazie bună te mai ia valul.",
          "Treci repede la fapte. Vrei lucrurile acum, riscul te atrage, iar la urmări te gândești abia după.",
          "Pentru orice lucru pe care îl vrei „acum”, așteaptă zece minute. Dacă îl mai vrei, ai ales tu, nu impulsul.",
          "Treci repede la fapte și nu te temi de risc.",
          "Amână cu o zi o decizie luată la nervi sau din impuls.")
      ],
      questions: likert("dk", 6, [
        ["apreciere", 1, "Îmi place să fiu remarcat pentru reușitele mele."], ["strategie", 1, "Într-o negociere, mă gândesc atent ce informații să spun."],
        ["impuls", 1, "Când sunt furios, pot reacționa fără să mă gândesc."], ["apreciere", 1, "Mă deranjează când altcineva primește laudele pe care le așteptam eu."],
        ["strategie", 1, "Uneori încerc să influențez oamenii fără să le explic intenția mea."], ["impuls", -1, "Îmi asum consecințele deciziilor mele."],
        ["apreciere", -1, "Pot accepta că nu sunt mereu în centrul atenției."], ["strategie", -1, "Prefer să fiu direct, chiar dacă pierd un avantaj."],
        ["impuls", 1, "Mă plictisesc repede și caut senzații noi."], ["apreciere", 1, "Îmi doresc să fiu văzut ca o persoană specială."],
        ["strategie", 1, "Îmi adaptez felul de a vorbi ca să obțin ce vreau."], ["impuls", -1, "Îmi este ușor să respect reguli care îi protejează pe ceilalți."],
        ["apreciere", 1, "Când sunt contrazis, simt nevoia să demonstrez că am dreptate."], ["strategie", 1, "Cred că este în regulă să ascunzi adevărul pentru un câștig personal."],
        ["impuls", 1, "Uneori risc prea mult pentru o recompensă imediată."], ["apreciere", -1, "Mă bucur sincer pentru succesul altcuiva."],
        ["strategie", -1, "Încerc să găsesc soluții bune pentru ambele părți."], ["impuls", -1, "Îmi pare rău când rănesc pe cineva."],
        ["apreciere", 1, "Mă simt nedreptățit când efortul meu nu este observat."], ["strategie", 1, "Îmi planific discuțiile importante înainte."],
        ["impuls", -1, "Înainte de o alegere riscantă, mă gândesc la urmări."], ["apreciere", -1, "Prefer să primesc feedback sincer, chiar dacă nu mă laudă."],
        ["strategie", 1, "Aș profita de o greșeală a cuiva dacă nimeni nu ar afla."], ["impuls", 1, "Îmi este greu să mă opresc când vreau ceva imediat."],
        ["apreciere", 1, "Îmi place să vorbesc despre realizările mele."], ["strategie", 1, "Îmi place să înțeleg ce îi motivează pe oameni."],
        ["impuls", -1, "Încerc să repar o greșeală pe care am făcut-o."]
      ])
    },

    leadership: {
      type: "likert",
      dims: [
        dim("initiativa", "Inițiativă", "munca", true, "Cât de des faci tu primul pas.",
          "Preferi să știi clar ce ai de făcut înainte să te apuci. Lucrezi bine pe un drum deja trasat.",
          "Iei inițiativa când subiectul te interesează. În rest, aștepți să vezi încotro merg lucrurile.",
          "Vezi o problemă și te apuci de ea. Nu aștepți să ți se ceară.",
          "O dată pe săptămână, propune tu un lucru mic: o idee, o schimbare, o întâlnire.",
          "Faci primul pas fără să aștepți să ți se ceară.",
          "Propune azi o idee pe care o ții pentru tine de ceva vreme."),
        dim("colaborare", "Colaborare", "munca", true, "Cât de bine lucrezi împreună cu alți oameni.",
          "Lucrezi cel mai bine pe cont propriu. Îți vine greu să ceri ajutor sau să te potrivești cu oameni foarte diferiți de tine.",
          "Lucrezi bine cu oamenii pe care îi cunoști. Cu cei foarte diferiți de tine îți ia mai mult până găsiți un ritm.",
          "Asculți echipa înainte să hotărăști, ceri ajutor fără jenă și împarți meritele cu cei care au pus umărul.",
          "La următoarea hotărâre, întreabă întâi doi oameni ce ar face ei. Hotărăști tot tu, dar cu mai multe informații.",
          "Asculți echipa și împarți meritele.",
          "Mulțumește azi cuiva, cu voce tare, pentru partea lui dintr-un lucru reușit."),
        dim("decizie", "Decizii", "munca", true, "Cât de bine cântărești și cât de ușor hotărăști.",
          "Amâni hotărârile de teamă să nu greșești sau te iei după prima impresie. Deciziile mari te apasă.",
          "Hotărăști bine când ai timp. Sub presiune, fie te grăbești, fie amâni.",
          "Compari avantajele cu riscurile, hotărăști cu informațiile pe care le ai și îți schimbi părerea când apar dovezi noi.",
          "Pentru o decizie pe care o tot amâni, scrie ce ai de câștigat, ce ai de pierdut și o dată-limită.",
          "Cântărești bine și hotărăști la timp.",
          "Ia azi o decizie pe care o tot amâni."),
        dim("responsabilitate", "Responsabilitate", "munca", true, "Cât de mult îți asumi ce ai promis și ce a ieșit.",
          "Când ceva iese prost, îți vine mai ușor să cauți un vinovat decât o soluție. Promisiunile se mai pierd pe drum.",
          "Te ții de cuvânt în lucrurile importante. Îți recunoști greșelile, chiar dacă nu pe loc.",
          "Îți recunoști greșelile, te ții de cuvânt și verifici dacă planul chiar a fost pus în practică.",
          "Când ceva merge prost, întreabă-te întâi „ce puteam face eu altfel?”. Abia apoi uită-te la ceilalți.",
          "Te ții de cuvânt și îți asumi rezultatul.",
          "Spune azi „am greșit” despre un lucru mic, fără nicio explicație în plus."),
        dim("adaptabilitate", "Adaptabilitate", "munca", true, "Cât de ușor te descurci când planul se schimbă.",
          "Schimbările de plan te scot din ritm. Ai nevoie să știi totul de la început ca să lucrezi bine.",
          "Te adaptezi după un moment de ezitare. Schimbările anunțate din timp nu te deranjează.",
          "Te adaptezi din mers, înveți repede o metodă nouă și poți lucra fără să ai toate răspunsurile.",
          "Când se schimbă planul, scrie pe loc noul prim pas. Un pas mic și clar te scoate din blocaj.",
          "Te adaptezi repede când se schimbă planul.",
          "Fă azi un lucru obișnuit într-un fel nou.")
      ],
      questions: likert("ld", 10, [
        ["initiativa", 1, "Când apare o problemă, propun primul pas."], ["colaborare", 1, "Ascult opiniile echipei înainte de o decizie."],
        ["decizie", 1, "Compar avantajele și riscurile înainte să aleg."], ["responsabilitate", 1, "Recunosc când am luat o decizie greșită."],
        ["adaptabilitate", 1, "Mă adaptez când planurile se schimbă."], ["initiativa", 1, "Îmi place să încep proiecte noi."],
        ["colaborare", 1, "Pot cere ajutor fără să mă simt mai puțin capabil."], ["decizie", 1, "Când timpul este scurt, pot decide cu informațiile disponibile."],
        ["responsabilitate", 1, "Îmi respect promisiunile față de echipă."], ["adaptabilitate", 1, "Învăț repede o metodă nouă dacă mă ajută."],
        ["initiativa", -1, "Aștept de obicei să îmi spună altcineva ce să fac."], ["colaborare", 1, "Îmi place să împart meritul cu cei care au contribuit."],
        ["decizie", -1, "Amân des o decizie de teamă să nu greșesc."], ["responsabilitate", -1, "Când ceva merge prost, caut întâi pe cine să dau vina."],
        ["adaptabilitate", -1, "Mă blochez când apare o situație neprevăzută."], ["initiativa", 1, "Mă implic când observ ceva ce poate fi îmbunătățit."],
        ["colaborare", -1, "Îmi este greu să lucrez cu persoane diferite de mine."], ["decizie", 1, "Îmi schimb părerea când apar dovezi noi."],
        ["responsabilitate", 1, "Urmăresc dacă planul a fost pus în practică."], ["adaptabilitate", 1, "Pot lucra bine și fără toate răspunsurile de la început."],
        ["initiativa", 1, "Îmi asum să organizez o activitate de grup."], ["colaborare", 1, "Dau feedback fără să umilesc."],
        ["decizie", -1, "Mă bazez numai pe prima impresie."], ["responsabilitate", 1, "Spun clar ce pot și ce nu pot face."],
        ["adaptabilitate", 1, "Cer feedback pentru a-mi îmbunătăți abordarea."]
      ])
    },

    relations: {
      type: "likert",
      dims: [
        dim("comunicare", "Comunicare", "relatii", true, "Cât de ușor spui ce simți și ce ai nevoie.",
          "Ții multe pentru tine și speri să se înțeleagă de la sine. Discuțiile incomode le amâni.",
          "Spui ce ai de spus când contează, dar lucrurile mici le lași să treacă.",
          "Spui ce ai nevoie fără să aștepți să se ghicească. Asculți până la capăt și întrebi dacă ai înțeles bine.",
          "Înlocuiește „nu am nimic” cu o propoziție care începe cu „M-a deranjat când…”.",
          "Spui deschis ce simți și întrebi în loc să presupui.",
          "Spune azi cuiva apropiat un lucru pe care îl ții de mult pentru tine."),
        dim("incredere", "Încredere", "relatii", true, "Cât de ușor te bazezi pe omul de lângă tine.",
          "Te temi că vei fi dezamăgit sau părăsit și îți vine greu să crezi că cineva ține la tine. Asta te ține în gardă.",
          "Ai încredere în omul de lângă tine, dar îndoielile mai apar când ceva nu e limpede.",
          "Pornești de la încredere. Poți vorbi sincer despre o greșeală și verifici faptele înainte să presupui.",
          "Când apare o îndoială, spune-o ca întrebare, nu ca acuzație: „Am înțeles bine că…?”",
          "Ai încredere și vorbești sincer.",
          "Spune-i azi cuiva drag un lucru pentru care ai încredere în el."),
        dim("limite", "Limite", "relatii", true, "Cât de bine îți aperi limitele și le respecți pe ale celuilalt.",
          "Spui „da” ca să nu superi și accepți lucruri care te deranjează, doar ca să fie liniște.",
          "Îți aperi limitele cu cei mai mulți oameni, dar cedezi în fața celor dragi.",
          "Poți spune „nu” fără vinovăție, spui clar ce nu accepți și respecți spațiul celuilalt.",
          "Când ți se cere ceva, răspunde întâi „mă gândesc și îți spun”. Câștigi timp să vezi dacă chiar vrei.",
          "Știi să spui „nu” și respecți limitele celuilalt.",
          "Spune azi „nu” unui lucru pe care l-ai face doar din obligație."),
        dim("conflict", "Conflicte", "relatii", true, "Cum te porți când nu sunteți de acord.",
          "Într-o ceartă vrei să câștigi. Aduci în discuție supărări vechi și te liniștești greu după aceea.",
          "De obicei cauți o soluție, dar la nervi îți mai scapă câte un reproș.",
          "Eviți jignirile, poți lua o pauză și reveni la discuție și cauți o soluție bună pentru amândoi.",
          "La următoarea ceartă, repetă întâi cu vorbele tale ce a spus celălalt. Abia apoi răspunde.",
          "Cauți soluții bune pentru amândoi.",
          "Cere-ți iertare pentru un lucru mic pe care l-ai lăsat nespus."),
        dim("obiective", "Obiective comune", "relatii", true, "Cât de deschis vorbești despre planuri, bani și viața împreună.",
          "Ocolești discuțiile despre bani, familie sau planuri. Speri ca lucrurile să se așeze de la sine.",
          "Vorbești despre viitor când vine vorba. Subiectele grele, ca banii sau familia, le mai amâni.",
          "Vorbești deschis despre planuri, bani și împărțirea treburilor și vrei să știi ce își dorește celălalt.",
          "Alege un singur subiect pe care îl ocoliți (bani, familie, locuință) și dă-i 20 de minute săptămâna aceasta.",
          "Vorbești deschis despre planurile voastre.",
          "Întreabă un om drag: „Ce ți-ai dori să facem împreună anul acesta?”")
      ],
      questions: likert("rl", 10, [
        ["comunicare", 1, "Îi spun partenerului ce am nevoie fără să aștept să ghicească."], ["incredere", 1, "Pot vorbi sincer despre o greșeală."],
        ["limite", 1, "Pot spune nu fără să mă simt obligat să mă justific excesiv."], ["conflict", 1, "Când ne certăm, evit jignirile."],
        ["obiective", 1, "Îmi place să discut despre planurile noastre pe termen lung."], ["comunicare", 1, "Ascult fără să pregătesc imediat un contraargument."],
        ["incredere", -1, "Mă îngrijorez des că voi fi părăsit fără un motiv clar."], ["limite", 1, "Respect când partenerul are nevoie de timp singur."],
        ["conflict", 1, "Pot face o pauză și reveni la discuție."], ["obiective", 1, "Consider important să vorbim deschis despre bani."],
        ["comunicare", -1, "Îmi este greu să vorbesc despre lucrurile care mă supără."], ["incredere", 1, "Respect intimitatea și spațiul personal al partenerului."],
        ["limite", -1, "Accept lucruri care mă deranjează doar ca să evit un conflict."], ["conflict", -1, "Aduc în discuție greșeli vechi ca să câștig o ceartă."],
        ["obiective", -1, "Îmi este greu să discut despre așteptările privind familia."], ["comunicare", 1, "Întreb dacă am înțeles corect ce a vrut să spună."],
        ["incredere", -1, "Îmi este greu să cred că cineva ține la mine."], ["limite", 1, "Discut deschis despre ce este acceptabil pentru fiecare."],
        ["conflict", 1, "Încerc să găsim o soluție pentru amândoi."], ["obiective", 1, "Încerc să înțeleg ce înseamnă o relație bună pentru celălalt."],
        ["comunicare", 1, "Pot spune ce apreciez la partener."], ["incredere", 1, "Pot cere reasigurare fără să controlez."],
        ["limite", 1, "Nu verific telefonul altcuiva fără acord."], ["conflict", 1, "Pot să îmi cer scuze fără să adaug imediat o scuză pentru mine."],
        ["obiective", 1, "Pot accepta că avem hobby-uri diferite."], ["comunicare", 1, "Discutăm problemele înainte să se adune."],
        ["incredere", 1, "Când apare o neînțelegere, verific faptele înainte să presupun."], ["limite", 1, "Îmi exprim clar limitele personale."],
        ["conflict", -1, "Îmi este greu să mă liniștesc după o ceartă."], ["obiective", 1, "Cred că e util să discutăm cum împărțim responsabilitățile."]
      ])
    },

    tarot: {
      type: "tarot",
      // Cele trei locuri din etalare, în ordine.
      positions: [
        { name: "Ce lași în urmă", hint: "Ce a contat până acum și se încheie." },
        { name: "Unde ești acum", hint: "Tema zilelor acestea." },
        { name: "Încotro mergi", hint: "La ce merită să fii atent mai departe." }
      ],
      // Cele 22 de arcane majore. „scurt” apare la cartea zilei, „personal” la cartea personală.
      cards: [
        { n: 0, name: "Nebunul", keys: "început, curaj, joacă", scurt: "Azi e o zi bună pentru un început, chiar dacă nu ai tot planul.", sens: "Nebunul pornește la drum fără să știe unde ajunge. Vorbește despre curajul de a începe și despre încrederea că te descurci pe parcurs.", umbra: "Entuziasmul fără nicio pregătire te poate costa.", sfat: "Fă primul pas mic azi, nu aștepta momentul perfect.", personal: "Ești omul începuturilor. Ai curajul să pornești acolo unde alții încă fac calcule, iar prospețimea ta îi molipsește pe cei din jur." },
        { n: 1, name: "Magicianul", keys: "voință, pricepere, acțiune", scurt: "Ai deja la îndemână tot ce îți trebuie.", sens: "Magicianul are pe masă toate uneltele. Vorbește despre puterea de a transforma o idee în ceva real, cu ce ai acum.", umbra: "Priceperea folosită ca să impresionezi, nu ca să construiești.", sfat: "Alege un singur lucru și pune-l în practică azi.", personal: "Ești omul care face lucrurile să se întâmple. Ai idei și pricepere, iar când le aduni într-un singur punct, puține îți rezistă." },
        { n: 2, name: "Marea Preoteasă", keys: "intuiție, liniște, taină", scurt: "Răspunsul pe care îl cauți îl știi deja.", sens: "Marea Preoteasă tace și ascultă. Vorbește despre intuiție și despre lucrurile pe care le simți înainte să le poți explica.", umbra: "Prea multă așteptare, când e nevoie de un cuvânt spus.", sfat: "Înainte să ceri păreri, ascultă ce îți spune prima ta impresie.", personal: "Simți lucrurile înainte să fie spuse. Oamenii îți încredințează secrete pentru că știi să asculți și să păstrezi." },
        { n: 3, name: "Împărăteasa", keys: "grijă, belșug, creație", scurt: "Ai grijă azi de ceva care crește: un om, o idee, tu.", sens: "Împărăteasa hrănește tot ce atinge. Vorbește despre grijă, răbdare și bucuria lucrurilor care cresc în ritmul lor.", umbra: "Grija pentru toți, mai puțin pentru tine.", sfat: "Fă azi un gest de grijă și pentru tine.", personal: "Lângă tine, lucrurile cresc. Ai răbdare, căldură și un dar de a face orice loc să pară acasă." },
        { n: 4, name: "Împăratul", keys: "ordine, hotărâre, sprijin", scurt: "Pune ordine într-un singur lucru și restul se așază.", sens: "Împăratul construiește reguli și ziduri care țin. Vorbește despre structură, răspundere și liniștea pe care o dă un plan clar.", umbra: "Controlul strâns, care nu mai lasă loc nimănui.", sfat: "Hotărăște azi un lucru pe care îl tot lași în aer.", personal: "Ești stâlpul pe care se sprijină ceilalți. Aduci ordine și hotărâre acolo unde e haos și îți asumi răspunderea." },
        { n: 5, name: "Marele Preot", keys: "învățătură, tradiție, sens", scurt: "Cineva a mai trecut pe aici. Cere un sfat.", sens: "Marele Preot păstrează ce s-a învățat înaintea noastră. Vorbește despre mentori, valori și rostul lucrurilor făcute cum trebuie.", umbra: "Regula urmată doar pentru că „așa se face”.", sfat: "Întreabă azi pe cineva cu mai multă experiență.", personal: "Ești omul la care lumea vine după un sfat. Ții la valorile tale și știi să explici lucrurile pe înțelesul oricui." },
        { n: 6, name: "Îndrăgostiții", keys: "alegere, apropiere, armonie", scurt: "O alegere făcută din inimă cântărește mai mult azi.", sens: "Îndrăgostiții stau în fața unei alegeri. Vorbesc despre apropiere, dar și despre a alege ce ți se potrivește cu adevărat.", umbra: "Alegerea amânată, de teamă să nu pierzi cealaltă variantă.", sfat: "Spune cuiva drag un lucru pe care îl simți și nu l-ai spus.", personal: "Pui suflet în tot ce alegi. Relațiile sunt locul în care înflorești, iar hotărârile tale vin din ce simți, nu doar din ce socotești." },
        { n: 7, name: "Carul", keys: "voință, direcție, victorie", scurt: "Ține direcția. Azi nu e ziua de ocolit.", sens: "Carul înaintează pentru că cel care îl conduce știe unde vrea să ajungă. Vorbește despre voință și despre a ține frâiele strâns.", umbra: "Graba care trece peste oameni.", sfat: "Alege un singur obiectiv pentru azi și nu te abate.", personal: "Când îți pui ceva în minte, ajungi acolo. Ai voință, direcție și puterea de a ține împreună lucruri care trag în părți diferite." },
        { n: 8, name: "Forța", keys: "blândețe, răbdare, curaj", scurt: "Blândețea rezolvă azi mai mult decât forța.", sens: "În carte, leul e îmblânzit cu mâna goală. Forța vorbește despre curajul liniștit și despre răbdarea care învinge fără să lovească.", umbra: "Răbdarea care devine înghițit în sec.", sfat: "Răspunde azi calm acolo unde te-ai fi enervat.", personal: "Puterea ta e liniștită. Nu ridici tonul ca să te faci auzit și treci prin greu cu o răbdare care îi uimește pe ceilalți." },
        { n: 9, name: "Pustnicul", keys: "retragere, căutare, înțelepciune", scurt: "Ia-ți azi o oră doar pentru tine.", sens: "Pustnicul urcă singur, cu o lampă mică. Vorbește despre retragere, despre gândit pe îndelete și despre răspunsurile găsite în liniște.", umbra: "Singurătatea aleasă ca să fugi de oameni.", sfat: "Stai azi zece minute fără telefon și fără zgomot.", personal: "Ai o lume interioară bogată. Îți găsești răspunsurile în liniște, iar ce spui, puțin și rar, are greutate." },
        { n: 10, name: "Roata Norocului", keys: "schimbare, noroc, cicluri", scurt: "Ceva se mișcă. Lasă-te dus puțin.", sens: "Roata se învârte: ce e sus coboară, ce e jos urcă. Vorbește despre schimbare și despre a prinde momentul când vine.", umbra: "Așteptatul norocului, fără niciun pas din partea ta.", sfat: "Spune „da” azi unei ocazii mici, neplănuite.", personal: "Te adaptezi din mers. Schimbările care îi sperie pe alții pe tine te pun în mișcare și știi să prinzi momentul." },
        { n: 11, name: "Dreptatea", keys: "adevăr, echilibru, răspundere", scurt: "Uită-te cinstit la un lucru pe care îl eviți.", sens: "Dreptatea ține balanța și sabia. Vorbește despre adevăr, despre urmările faptelor și despre a cântări fără părtinire.", umbra: "Judecata aspră, cu tine sau cu ceilalți.", sfat: "Înainte să judeci azi, ascultă și partea cealaltă.", personal: "Ai un simț puternic al corectitudinii. Cântărești înainte să hotărăști și oamenii au încredere în judecata ta." },
        { n: 12, name: "Spânzuratul", keys: "pauză, alt unghi, răbdare", scurt: "Dacă nu merge înainte, uită-te din alt unghi.", sens: "Spânzuratul stă cu capul în jos și vede lumea altfel. Vorbește despre pauză și despre ce câștigi când renunți la a forța.", umbra: "Așteptarea care devine amânare.", sfat: "Lasă azi deoparte un lucru care nu merge și revino mâine.", personal: "Vezi lucrurile din unghiuri la care alții nu se gândesc. Știi că uneori cel mai bun pas este să aștepți." },
        { n: 13, name: "Moartea", keys: "sfârșit, transformare, loc nou", scurt: "Ceva se încheie ca să facă loc altcuiva.", sens: "Cartea nu vorbește despre moarte, ci despre un capitol care se închide. După ce lași ceva în urmă, apare loc pentru altceva.", umbra: "Agățatul de ce s-a terminat deja.", sfat: "Renunță azi la un lucru mic care nu îți mai folosește.", personal: "Ești omul transformărilor. Știi să închizi un capitol și să o iei de la capăt, mai limpede decât înainte." },
        { n: 14, name: "Cumpătarea", keys: "măsură, răbdare, amestec bun", scurt: "Nici prea mult, nici prea puțin. Azi caută mijlocul.", sens: "Cumpătarea toarnă apă dintr-un vas în altul, fără să verse. Vorbește despre măsură, răbdare și despre a împăca lucruri opuse.", umbra: "Evitatul oricărei poziții, de dragul liniștii.", sfat: "Găsește azi un lucru pe care îl faci în exces și taie-l la jumătate.", personal: "Aduci echilibru oriunde ajungi. Împaci oameni și idei care par să nu se potrivească și nu te grăbești." },
        { n: 15, name: "Diavolul", keys: "tentație, obișnuință, dorință", scurt: "Vezi ce te ține legat: un obicei, o teamă, o poftă.", sens: "Lanțurile din carte sunt largi: cei legați ar putea pleca. Diavolul vorbește despre obiceiurile și dorințele care ne conduc fără să ne dăm seama.", umbra: "Plăcerea de moment, plătită mai târziu.", sfat: "Sari azi o singură dată peste un obicei care te ține pe loc.", personal: "Ai dorințe puternice și nu te ascunzi de ele. Când îți cunoști tentațiile, ele devin combustibil, nu lanț." },
        { n: 16, name: "Turnul", keys: "zguduire, adevăr, eliberare", scurt: "Ce se clatină azi nu era bine prins.", sens: "Fulgerul lovește un turn ridicat strâmb. Turnul vorbește despre schimbările bruște care dărâmă ce nu era adevărat și lasă loc de construit din nou.", umbra: "Dărâmatul din nervi a ceva ce merita reparat.", sfat: "Spune azi un adevăr pe care îl ocolești.", personal: "Nu te temi de schimbările mari. Spui adevărul chiar când zguduie și știi să construiești din nou, pe o temelie mai bună." },
        { n: 17, name: "Steaua", keys: "speranță, liniște, încredere", scurt: "După greu vine o zi limpede. Poate fi azi.", sens: "Steaua apare după furtună. Vorbește despre speranță, vindecare și încrederea că lucrurile se așază.", umbra: "Visatul, fără niciun pas spre vis.", sfat: "Scrie azi un lucru pe care îl speri și un pas mic spre el.", personal: "Dai speranță fără să faci zgomot. Oamenii pleacă de lângă tine mai liniștiți și cu mai multă încredere în ei." },
        { n: 18, name: "Luna", keys: "vis, îndoială, intuiție", scurt: "Nu tot ce pare azi este așa. Mai așteaptă puțin.", sens: "La lumina Lunii, lucrurile își schimbă forma. Cartea vorbește despre vise, temeri și despre a merge înainte chiar când nu vezi tot drumul.", umbra: "Frica luată drept adevăr.", sfat: "Nu lua azi o hotărâre mare la oboseală sau la supărare.", personal: "Ai imaginație și o intuiție fină. Vezi nuanțe acolo unde alții văd alb și negru și te pricepi la ce nu se spune." },
        { n: 19, name: "Soarele", keys: "bucurie, limpezime, reușită", scurt: "Azi lucrurile sunt mai simple decât par. Bucură-te.", sens: "Soarele luminează tot, fără umbre. Vorbește despre bucurie, energie și reușita care vine când ești tu, pe față.", umbra: "Strălucirea care îi lasă pe ceilalți în umbră.", sfat: "Fă azi un lucru doar pentru că te bucură.", personal: "Aduci lumină. Ai o bucurie simplă, care se ia, și oamenii se simt mai bine doar pentru că ești acolo." },
        { n: 20, name: "Judecata", keys: "trezire, iertare, chemare", scurt: "E timpul să ierți ceva și să mergi mai departe.", sens: "Trâmbița din carte cheamă la o viață nouă. Judecata vorbește despre a te uita cinstit înapoi, a ierta și a răspunde la ce te cheamă.", umbra: "Reproșurile vechi, purtate prea mult.", sfat: "Iartă azi un lucru mic, ție sau altcuiva.", personal: "Ai puterea să o iei de la capăt. Înveți din ce a fost, ierți și auzi limpede ce ai de făcut mai departe." },
        { n: 21, name: "Lumea", keys: "împlinire, întreg, drum încheiat", scurt: "Uită-te cât ai mers. Ai voie să te bucuri.", sens: "Lumea închide cercul început de Nebun. Vorbește despre un drum dus la capăt și despre sentimentul că lucrurile sunt la locul lor.", umbra: "Oprirea pe loc, de teamă să nu strici ce ai.", sfat: "Sărbătorește azi un lucru pe care l-ai dus la capăt.", personal: "Duci lucrurile până la capăt. Vezi întregul, nu doar bucățile, și ai darul de a lega oameni și idei." }
      ]
    }
  },

  // Testul rapid, gratuit: zece întrebări amestecate (rândurile FREE din bibliotecă). Nu se păstrează nimic din el.
  // O variantă cu right: true e răspunsul corect, iar întrebarea intră la scor. Dacă nicio variantă nu e bifată,
  // omul vede la final „note” (ce spune alegerea lui), iar „module” e testul spre care trage acel răspuns.
  quick: {
    // Textul de sub scor, după procentul de răspunsuri corecte.
    thresholds: { low: 50, high: 100 },
    levels: {
      low: { title: "Azi te-ai grăbit", text: "Întrebările erau scurte, dar fiecare avea o mică capcană. Pe fugă, scapă oricui. La testul de logică ai timp să te așezi." },
      mid: { title: "Aproape tot", text: "Ai prins cele mai multe capcane. Ce a scăpat vine de obicei din grabă, nu din neștiință." },
      high: { title: "Nu ți-a scăpat nimic", text: "Ai fost atent la detalii și nu te-ai lăsat păcălit de procente. Testul de logică pornește de aici și urcă mult." }
    },
    questions: [
      { id: "r01", topic: "Viața reală", text: "Un prieten îți promite ceva și nu se ține de cuvânt. Ce faci?", explain: "", options: [
        { text: "Îi spun ce m-a deranjat", note: "Spui lucrurilor pe nume. Oamenii știu unde se află cu tine, iar supărările nu apucă să se adune.", module: "relations", right: false },
        { text: "Întreb ce s-a întâmplat", note: "Întâi vrei să înțelegi, abia apoi judeci. Le lași oamenilor loc să se explice.", module: "emotional", right: false },
        { text: "Mă retrag", note: "Te ferești de discuțiile incomode. Scapi de ceartă pe moment, dar celălalt nu află ce te-a durut.", module: "relations", right: false },
        { text: "Fac o glumă și trec peste", note: "Destinzi lucrurile cu umor. Merită să te întrebi dacă gluma închide subiectul sau doar îl amână.", module: "emotional", right: false }
      ] },
      { id: "r02", topic: "Logică", text: "Un produs de 100 lei se reduce cu 20%, apoi crește cu 20%. Cât costă?", explain: "După reducere costă 80 de lei. 20% din 80 înseamnă 16 lei, deci ajunge la 96, nu înapoi la 100.", options: [
        { text: "100 lei", note: "", module: "", right: false },
        { text: "96 lei", note: "", module: "", right: true },
        { text: "98 lei", note: "", module: "", right: false },
        { text: "104 lei", note: "", module: "", right: false }
      ] },
      { id: "r03", topic: "Atenție", text: "Care șir e diferit?", explain: "Al treilea șir se termină în 3, nu în 8.", options: [
        { text: "B8B8", note: "", module: "", right: false },
        { text: "B8B8", note: "", module: "", right: false },
        { text: "B8B3", note: "", module: "", right: true },
        { text: "B8B8", note: "", module: "", right: false }
      ] },
      { id: "r04", topic: "Relații", text: "Ai o discuție importantă, dar ești obosit. Ce faci?", explain: "", options: [
        { text: "Discut acum", note: "Nu lași lucrurile să aștepte. E bine, cât timp nu vorbește oboseala în locul tău.", module: "relations", right: false },
        { text: "Propun o oră potrivită", note: "Știi că o discuție bună are nevoie de un moment bun. Îți cunoști limitele și le spui.", module: "emotional", right: false },
        { text: "Evit discuția", note: "Când nu mai ai energie, amâni. Pe moment ajută, dar discuția rămâne acolo.", module: "relations", right: false },
        { text: "Ascult fără să spun nimic", note: "Ești de față, dar îți ții părerea pentru tine. Celălalt poate crede că ești de acord.", module: "relations", right: false }
      ] },
      { id: "r05", topic: "Memorie", text: "Ține minte: LUNĂ, CHEIE, PORTOCALĂ. Care este al doilea cuvânt?", explain: "Ordinea era LUNĂ, CHEIE, PORTOCALĂ.", options: [
        { text: "LUNĂ", note: "", module: "", right: false },
        { text: "CHEIE", note: "", module: "", right: true },
        { text: "PORTOCALĂ", note: "", module: "", right: false },
        { text: "Nu știu", note: "", module: "", right: false }
      ] },
      { id: "r06", topic: "Emoții", text: "Când cineva te critică în public, ce faci de obicei?", explain: "", options: [
        { text: "Cer un exemplu concret", note: "Rămâi cu picioarele pe pământ și cauți ce e de folos în critică. Nu o iei personal din prima.", module: "leadership", right: false },
        { text: "Mă apăr", note: "Reacționezi repede când te simți atacat. E firesc. Contează ce faci după ce trece primul val.", module: "emotional", right: false },
        { text: "Tac, dar mă afectează", note: "Duci critica în tine mai mult decât se vede. Ce nu spui pe loc rămâne cu tine mai mult timp.", module: "emotional", right: false },
        { text: "Schimb subiectul", note: "Ieși repede din situațiile care te pun într-o lumină proastă. Scapi de moment, nu și de întrebare.", module: "dark", right: false }
      ] },
      { id: "r07", topic: "Calcul", text: "Trei prieteni împart 150 lei în mod egal. Cât plătește fiecare?", explain: "150 împărțit la 3 face 50.", options: [
        { text: "30", note: "", module: "", right: false },
        { text: "40", note: "", module: "", right: false },
        { text: "50", note: "", module: "", right: true },
        { text: "60", note: "", module: "", right: false }
      ] },
      { id: "r08", topic: "Decizii", text: "Ai două oferte de muncă. Ce contează cel mai mult?", explain: "", options: [
        { text: "Banii", note: "Vrei ca munca ta să se vadă în ceva concret. Știi cât valorezi și nu te sfiești să ceri.", module: "leadership", right: false },
        { text: "Timpul liber", note: "Munca e o parte din viața ta, nu toată. Îți aperi timpul pentru oameni și pentru tine.", module: "bigfive", right: false },
        { text: "Dezvoltarea", note: "Te atrage ce poți învăța, nu doar ce primești. Te plictisești repede acolo unde nu mai crești.", module: "bigfive", right: false },
        { text: "Stabilitatea", note: "Îți place să știi pe ce te bazezi. Construiești încet și sigur.", module: "bigfive", right: false }
      ] },
      { id: "r09", topic: "Atenție", text: "Care simbol apare o singură dată?", explain: "Triunghiul apare o dată, cercul de trei ori.", options: [
        { text: "●", note: "", module: "", right: false },
        { text: "▲", note: "", module: "", right: true },
        { text: "●", note: "", module: "", right: false },
        { text: "●", note: "", module: "", right: false }
      ] },
      { id: "r10", topic: "Dezvoltare", text: "Ce ai vrea să îmbunătățești în următoarea lună?", explain: "", options: [
        { text: "Concentrarea", note: "Simți că atenția ți se împarte în prea multe locuri. E primul lucru de antrenat și cel mai ușor de măsurat.", module: "iq", right: false },
        { text: "Comunicarea", note: "Vrei să te faci mai bine înțeles și să îi înțelegi mai bine pe ceilalți.", module: "relations", right: false },
        { text: "Încrederea", note: "Știi că poți mai mult decât arăți. Încrederea crește din lucruri mici, duse la capăt.", module: "leadership", right: false },
        { text: "Gestionarea stresului", note: "Duci mult și se simte. Să știi ce te încarcă e jumătate din drum.", module: "emotional", right: false }
      ] }
    ]
  },

  // Testul de cuplu „Cât ne cunoaștem?”.
  couple: {
    cats: [
      { id: "timp", name: "Timp împreună", apropie: "Vă plac aceleași feluri de a petrece timpul. Nu trebuie să negociați fiecare seară liberă.", discuta: "Vă imaginați diferit timpul liber. Merită să spuneți fiecare ce înseamnă pentru el o seară bună.", intrebare: "Cum ar arăta pentru fiecare un weekend perfect?" },
      { id: "bani", name: "Bani", apropie: "Vedeți banii la fel, iar asta scutește multe discuții.", discuta: "Aveți obiceiuri diferite cu banii. E mai ușor să vorbiți despre ele acum decât la prima cumpărătură mare.", intrebare: "Pe ce ar cheltui fiecare, fără remușcări, 1.000 de lei?" },
      { id: "certuri", name: "Certuri și împăcări", apropie: "Vă certați și vă împăcați în același fel, deci vă regăsiți repede.", discuta: "Aveți ritmuri diferite după o ceartă: unul vrea să lămurească pe loc, celălalt are nevoie de timp.", intrebare: "Ce te-ar ajuta cel mai mult în primele zece minute după o ceartă?" },
      { id: "afectiune", name: "Afecțiune", apropie: "Vă arătați dragostea în același fel, deci gesturile ajung unde trebuie.", discuta: "Vă arătați dragostea în feluri diferite. Ce oferă unul poate să nu fie ce așteaptă celălalt.", intrebare: "Ce gest mic al celuilalt îți arată cel mai bine că ține la tine?" },
      { id: "viitor", name: "Viitor", apropie: "Vă uitați în aceeași direcție când vine vorba de viitor.", discuta: "Vă vedeți viitorul puțin diferit. Nu e o problemă, dacă știți amândoi asta.", intrebare: "Cum ar arăta o zi obișnuită din viața voastră peste zece ani?" },
      { id: "zi", name: "Viața de zi cu zi", apropie: "Aveți obiceiuri care se potrivesc, iar viața de zi cu zi merge ușor.", discuta: "Aveți ritmuri diferite în viața de zi cu zi. Lucrurile mici, spuse la timp, nu se adună.", intrebare: "Ce obicei mărunt al celuilalt îți place cel mai mult?" }
    ],
    // Cât de bine s-au ghicit, în procente (media celor doi).
    levels: {
      low: { title: "Aveți multe de descoperit", text: "V-ați ghicit mai rar decât v-ați fi așteptat. E o veste bună: aveți despre ce vorbi." },
      mid: { title: "Vă cunoașteți bine, cu surprize", text: "Știți multe unul despre altul, dar nu tot. Surprizele de mai jos sunt cele mai bune subiecte de discuție." },
      high: { title: "Vă știți pe de rost", text: "Vă ghiciți aproape de fiecare dată. Rămâne doar să nu luați asta de-a gata." }
    },
    thresholds: { low: 40, high: 70 },
    questions: pick("cp", [
      ["timp", 1, "Cum arată o seară liberă ideală pentru tine?", ["Acasă, cu un film", "La restaurant sau în oraș", "Cu prietenii", "Fiecare cu ale lui, apoi împreună"]],
      ["bani", 1, "Ce faci cu o sumă de bani primită pe neașteptate?", ["O pun deoparte", "Cumpăr ceva ce îmi doream", "O cheltui pe o experiență", "O investesc"]],
      ["certuri", 1, "Ce faci imediat după o ceartă?", ["Vreau să lămurim pe loc", "Am nevoie de timp în liniște", "Fac o glumă ca să destind", "Aștept ca celălalt să facă primul pas"]],
      ["afectiune", 1, "Cum simți cel mai bine că cineva te iubește?", ["Prin cuvinte", "Prin timp petrecut împreună", "Prin gesturi și ajutor", "Prin atingeri"]],
      ["viitor", 1, "Unde te vezi locuind peste zece ani?", ["Într-un oraș mare", "Într-un oraș mic sau la țară", "În altă țară", "Unde ne duce viața"]],
      ["zi", 1, "Cum ești dimineața?", ["Cu chef de vorbă", "Fără cuvinte până la cafea", "Pe fugă", "Dimineața nu există pentru mine"]],
      ["timp", 1, "Ce vacanță ai alege?", ["La mare, la soare", "La munte, în natură", "Un oraș nou de explorat", "Acasă, fără niciun plan"]],
      ["bani", 1, "Cum ar trebui împărțite cheltuielile într-un cuplu?", ["Totul la comun", "Jumătate-jumătate", "Fiecare după cât câștigă", "Fiecare cu banii lui"]],
      ["certuri", 1, "Ce te supără cel mai tare într-o discuție aprinsă?", ["Tonul ridicat", "Tăcerea", "Întreruperile", "Reproșurile vechi"]],
      ["afectiune", 1, "Cât de des ai vrea să vă spuneți „te iubesc”?", ["În fiecare zi", "Din când în când", "Rar, dar cu sens", "Faptele contează mai mult"]],
      ["viitor", 0, "Ce înseamnă pentru tine o viață reușită?", ["O familie unită", "O carieră împlinită", "Libertate și călătorii", "Liniște și sănătate"]],
      ["zi", 0, "Ce treabă din casă îți displace cel mai mult?", ["Spălatul vaselor", "Gătitul", "Curățenia", "Cumpărăturile"]],
      ["timp", 0, "De cât timp doar pentru tine ai nevoie într-o săptămână?", ["Aproape deloc", "Câteva ore", "O zi întreagă", "Cât mai mult"]],
      ["bani", 0, "Cum se face o cumpărătură mare?", ["Doar după ce vorbim amândoi", "Hotărăsc eu, apoi spun", "Fiecare decide pe banii lui", "Depinde de sumă"]],
      ["certuri", 0, "Cât durează până îți trece supărarea?", ["Câteva minute", "Câteva ore", "O zi sau două", "Mult, țin minte"]],
      ["afectiune", 0, "Ce gest mic te bucură cel mai mult?", ["Un mesaj în timpul zilei", "O cafea adusă la pat", "O îmbrățișare din senin", "O surpriză plănuită"]],
      ["viitor", 0, "Cum iei o decizie mare de viață?", ["Cu liste și calcule", "După instinct", "Cer părerea celor apropiați", "Amân până devine clar"]],
      ["zi", 0, "Ce faci când ai avut o zi grea?", ["Vreau să povestesc", "Vreau liniște", "Am nevoie de o îmbrățișare", "Mă apuc de altceva ca să uit"]],
      ["timp", 0, "Ce v-ar apropia cel mai mult?", ["O călătorie în doi", "Un proiect comun", "Mai multe seri liniștite acasă", "Un hobby nou, împreună"]],
      ["bani", 0, "Ce te liniștește cel mai mult când vine vorba de bani?", ["Economii pentru zile negre", "Un venit stabil", "Să nu am datorii", "Să pot cheltui fără să număr"]],
      ["certuri", 0, "Cum îți ceri iertare?", ["Spun direct „îmi pare rău”", "Printr-un gest", "Mă port mai frumos, fără cuvinte", "Îmi vine greu să o fac"]],
      ["afectiune", 0, "Cum te porți în public cu partenerul?", ["Ne ținem de mână și ne îmbrățișăm", "Discret, câte un gest", "Păstrez afecțiunea pentru acasă", "Depinde de loc"]],
      ["viitor", 0, "Ce ai schimba prima dată în viața voastră?", ["Locuința", "Programul de lucru", "Timpul petrecut împreună", "Nimic, e bine așa"]],
      ["zi", 0, "Cât de multă ordine ții în jurul tău?", ["Totul la locul lui", "Ordine în mare", "Dezordine organizată", "Haos, și îmi convine"]],
      ["timp", 0, "Cum îți place să sărbătorești ziua ta?", ["Petrecere mare", "Cină în doi", "Cu câțiva prieteni apropiați", "Fără nimic special"]],
      ["bani", 0, "Un cadou bun este…", ["Ceva util", "Ceva scump și deosebit", "Ceva făcut de mână", "O experiență, nu un obiect"]],
      ["certuri", 0, "Ce contează mai mult după o neînțelegere?", ["Să găsim o soluție", "Să simt că am fost înțeles", "Să ne împăcăm repede", "Să nu se repete"]],
      ["afectiune", 0, "Ce îți lipsește cel mai des?", ["Mai multe discuții", "Mai mult timp în doi", "Mai multă tandrețe", "Nu îmi lipsește nimic"]],
      ["viitor", 0, "Cât de mult plănuiești viitorul?", ["Am un plan pe ani", "Am câteva repere", "Trăiesc de pe o lună pe alta", "Prefer să mă las în voia vieții"]],
      ["zi", 0, "Telefonul la masă…", ["Niciodată", "Doar dacă e ceva urgent", "Nu mă deranjează", "Îl folosesc și eu"]]
    ])
  },

  // Raportul care leagă testele între ele.
  report: {
    // Titlul profilului vine din cele două trăsături de personalitate cu scorul cel mai mare.
    archetypes: [
      { a: "E", b: "A", title: "Gazda caldă", tagline: "Aduci oamenii împreună și îi faci să se simtă bine." },
      { a: "E", b: "C", title: "Motorul echipei", tagline: "Energie multă, pusă la treabă cu plan." },
      { a: "E", b: "S", title: "Prezența sigură", tagline: "Te simți în largul tău între oameni și puține te clatină." },
      { a: "E", b: "O", title: "Exploratorul sociabil", tagline: "Idei noi, spuse cu voce tare." },
      { a: "A", b: "C", title: "Omul de nădejde", tagline: "Ai grijă de oameni și te ții de cuvânt." },
      { a: "A", b: "S", title: "Portul liniștit", tagline: "Lângă tine, ceilalți se liniștesc." },
      { a: "A", b: "O", title: "Exploratorul empatic", tagline: "Curiozitate pentru idei și pentru oameni." },
      { a: "C", b: "S", title: "Strategul calm", tagline: "Plan clar și mână sigură." },
      { a: "C", b: "O", title: "Constructorul de idei", tagline: "Imaginație dusă până la capăt." },
      { a: "S", b: "O", title: "Gânditorul senin", tagline: "Minte deschisă, stare liniștită." }
    ],
    fallbackTitle: "Profilul tău",
    fallbackTagline: "Titlul profilului apare după testul complet de personalitate.",
    // Zilele care nu vin din trăsăturile tale se completează de aici, în această ordine.
    challenges: [
      "Notează trei situații în care te-ai simțit în elementul tău.",
      "Găsește un lucru care îți consumă inutil energia și renunță la el pentru o zi.",
      "Fă un lucru doar pentru plăcerea ta, fără niciun scop.",
      "Mulțumește-i cuiva pentru ceva concret.",
      "Recitește notițele din săptămână și alege un obicei pe care vrei să îl păstrezi."
    ],
    workIntro: "Unde te ajută trăsăturile tale când lucrezi:",
    loveIntro: "Cum se văd trăsăturile tale într-o relație:",
    growthIntro: "Scorurile cele mai mici nu sunt defecte. Sunt locurile unde un pas mic schimbă cel mai mult.",
    iqLine: "Intervalul tău orientativ este {lo}–{hi}. Te-ai descurcat cel mai bine la: {zona}."
  }
};

module.exports = { TESTS };
