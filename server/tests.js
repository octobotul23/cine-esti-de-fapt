// Valorile implicite ale testelor: întrebări, chei de răspuns, texte de raport, cărți de tarot.
// Fișierul nu se servește niciodată în browser. Tot ce e aici se poate schimba din panou (/admin → Teste).
//
// Sursa întrebărilor:
// - Personalitate: cei 50 de itemi IPIP (Goldberg, domeniu public), în traducere proprie.
// - Restul testelor: întrebări scrise pentru acest site. Nu sunt instrumente psihometrice etalonate.

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
  scale: ["Deloc de acord", "Mai degrabă nu", "Nici da, nici nu", "Mai degrabă da", "Total de acord"],
  // Sub „low” scorul e mic, de la „high” în sus e mare (0–100).
  levels: { low: 40, high: 60 },

  modules: {
    bigfive: {
      type: "likert",
      dims: [
        dim("E", "Extraversie", "munca", true, "Câtă energie îți iei din contactul cu oamenii.",
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
        dim("C", "Conștiinciozitate", "munca", true, "Cât de bine îți organizezi lucrurile și cât ții de ele.",
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
      questions: likert("bf", 10, [
        ["E", 1, "Sunt sufletul petrecerii."], ["A", -1, "Îmi pasă puțin de ceilalți."], ["C", 1, "Am mereu totul pregătit din timp."],
        ["S", -1, "Mă stresez ușor."], ["O", 1, "Am un vocabular bogat."], ["E", -1, "Nu vorbesc mult."],
        ["A", 1, "Mă interesează oamenii."], ["C", -1, "Îmi las lucrurile împrăștiate."], ["S", 1, "Am o stare relaxată în cea mai mare parte a timpului."],
        ["O", -1, "Înțeleg greu ideile abstracte."], ["E", 1, "Mă simt bine printre oameni."], ["A", -1, "Jignesc oamenii."],
        ["C", 1, "Dau atenție detaliilor."], ["S", -1, "Îmi fac griji."], ["O", 1, "Am o imaginație vie."],
        ["E", -1, "Rămân în plan secund."], ["A", 1, "Înțeleg ce simt ceilalți și îmi pasă."], ["C", -1, "Încurc lucrurile."],
        ["S", 1, "Rareori am zile triste."], ["O", -1, "Nu mă interesează ideile abstracte."], ["E", 1, "Încep eu conversațiile."],
        ["A", -1, "Nu mă interesează problemele altora."], ["C", 1, "Fac treburile imediat, fără să le amân."], ["S", -1, "Mă tulbur ușor."],
        ["O", 1, "Am idei foarte bune."], ["E", -1, "Am puține de spus."], ["A", 1, "Am o inimă bună."],
        ["C", -1, "Uit des să pun lucrurile la locul lor."], ["S", -1, "Mă supăr ușor."], ["O", -1, "Nu am prea multă imaginație."],
        ["E", 1, "La petreceri vorbesc cu mulți oameni diferiți."], ["A", -1, "Nu mă interesează cu adevărat ceilalți."], ["C", 1, "Îmi place ordinea."],
        ["S", -1, "Îmi schimb des dispoziția."], ["O", 1, "Înțeleg repede lucrurile."], ["E", -1, "Nu îmi place să atrag atenția asupra mea."],
        ["A", 1, "Îmi fac timp pentru ceilalți."], ["C", -1, "Mă eschivez de la îndatoriri."], ["S", -1, "Trec des de la o stare la alta."],
        ["O", 1, "Folosesc cuvinte pretențioase."], ["E", 1, "Nu mă deranjează să fiu în centrul atenției."], ["A", 1, "Simt emoțiile celorlalți."],
        ["C", 1, "Respect un program."], ["S", -1, "Mă enervez ușor."], ["O", 1, "Îmi iau timp să reflectez la lucruri."],
        ["E", -1, "Tac în preajma necunoscuților."], ["A", 1, "Îi fac pe oameni să se simtă în largul lor."], ["C", 1, "Am pretenții mari de la munca mea."],
        ["S", -1, "Am des zile triste."], ["O", 1, "Îmi vin mereu idei."]
      ])
    },

    iq: {
      type: "quiz",
      areas: [
        { id: "logica", name: "Logică" }, { id: "numeric", name: "Numere" },
        { id: "tipare", name: "Tipare" }, { id: "verbal", name: "Cuvinte" }
      ],
      // De la ce procent de răspunsuri corecte în sus se afișează fiecare interval. Estimare, nu etalonare.
      bands: [
        { min: 0, lo: 75, hi: 85 }, { min: 20, lo: 85, hi: 95 }, { min: 40, lo: 95, hi: 105 },
        { min: 55, lo: 105, hi: 115 }, { min: 70, lo: 115, hi: 125 }, { min: 85, lo: 125, hi: 135 }
      ],
      questions: quiz("iq", [
        ["tipare", 1, "Ce număr urmează? 2, 6, 12, 20, 30, …", ["36", "40", "42", "44"], 2, "Diferențele cresc cu 2: 4, 6, 8, 10, apoi 12. 30 + 12 = 42."],
        ["numeric", 1, "Un tricou costă 80 de lei după o reducere de 20%. Cât costa înainte?", ["96 de lei", "100 de lei", "104 lei", "120 de lei"], 1, "80 de lei înseamnă 80% din prețul vechi, deci prețul vechi era 100 de lei."],
        ["logica", 1, "Maria este mai rapidă decât Ioana. Ioana este mai rapidă decât Elena. Paul este mai rapid decât Maria. Cine este cel mai lent?", ["Maria", "Ioana", "Elena", "Paul"], 2, "Ordinea este Paul, Maria, Ioana, Elena."],
        ["verbal", 1, "Carte este pentru bibliotecă ce este tablou pentru…", ["pictor", "galerie", "ramă", "culoare"], 1, "Cărțile se păstrează în bibliotecă, tablourile în galerie."],
        ["tipare", 1, "Ce literă urmează? B, E, H, K, …", ["L", "M", "N", "O"], 2, "Se sare câte două litere: B, E, H, K, N."],
        ["numeric", 1, "Media a cinci numere este 12. Patru dintre ele sunt 10, 14, 9 și 15. Care este al cincilea?", ["10", "11", "12", "13"], 2, "Suma trebuie să fie 60. Cele patru numere dau 48, deci lipsește 12."],
        ["logica", 1, "Dacă plouă, strada e udă. Strada e udă. Ce poți spune sigur?", ["A plouat.", "Nu a plouat.", "Nu se poate ști sigur dacă a plouat.", "Strada e mereu udă."], 2, "Strada poate fi udă și din alt motiv, deci nu rezultă că a plouat."],
        ["verbal", 1, "Care cuvânt nu se potrivește cu celelalte?", ["vioară", "chitară", "flaut", "violoncel"], 2, "Flautul este instrument de suflat, celelalte au coarde."],
        ["tipare", 0, "Ce număr urmează? 1, 1, 2, 3, 5, 8, …", ["11", "12", "13", "15"], 2, "Fiecare număr este suma celor două dinaintea lui: 5 + 8 = 13."],
        ["numeric", 0, "Trei muncitori termină o lucrare în 12 zile. În câte zile o termină patru muncitori, în același ritm?", ["8", "9", "10", "16"], 1, "Lucrarea cere 36 de zile de muncă. Împărțite la patru muncitori, ies 9 zile."],
        ["logica", 0, "Într-o familie sunt patru frați. Fiecare frate are o soră. Câți copii sunt, cel puțin, în familie?", ["4", "5", "6", "8"], 1, "Ajunge o singură soră pentru toți cei patru frați: 5 copii."],
        ["verbal", 0, "Cald este pentru fierbinte ce este rece pentru…", ["răcoros", "înghețat", "călduț", "umed"], 1, "Fierbinte înseamnă foarte cald, înghețat înseamnă foarte rece."],
        ["tipare", 0, "Ce număr urmează? 81, 27, 9, 3, …", ["0", "1", "2", "6"], 1, "Fiecare număr se împarte la 3."],
        ["numeric", 0, "Un tren parcurge 150 km în o oră și 15 minute. Care este viteza lui medie?", ["100 km/h", "112,5 km/h", "120 km/h", "125 km/h"], 2, "O oră și 15 minute înseamnă 1,25 ore. 150 : 1,25 = 120."],
        ["logica", 0, "Toți pictorii din club sunt stângaci. Unii stângaci din oraș cântă la pian. Ce rezultă obligatoriu?", ["Unii pictori din club cântă la pian.", "Toți cei care cântă la pian sunt pictori.", "Niciun pictor din club nu cântă la pian.", "Niciuna dintre concluziile de mai sus."], 3, "Stângacii care cântă la pian pot fi alții decât pictorii din club, deci nu rezultă nimic sigur."],
        ["verbal", 0, "Ce cuvânt are sensul cel mai apropiat de „efemer”?", ["veșnic", "trecător", "fragil", "rar"], 1, "Efemer înseamnă care durează puțin."],
        ["tipare", 0, "Ce număr urmează? 4, 9, 19, 39, …", ["59", "69", "78", "79"], 3, "Fiecare număr se dublează și se adaugă 1: 39 × 2 + 1 = 79."],
        ["numeric", 0, "Ana are de două ori vârsta lui Radu și este cu 6 ani mai mare decât el. Câți ani are Ana?", ["8", "10", "12", "18"], 2, "Radu are 6 ani, iar Ana de două ori pe atât: 12."],
        ["logica", 0, "Ai trei cutii: una doar cu mere, una doar cu pere și una cu amestec. Toate etichetele sunt greșite. Scoți un fruct din cutia pe care scrie „amestec” și este un măr. Ce conține cutia pe care scrie „pere”?", ["Doar mere", "Doar pere", "Amestec", "Nu se poate ști"], 2, "Cutia „amestec” are de fapt doar mere. Cutia „pere” nu poate avea pere, iar merele sunt luate, deci are amestec."],
        ["verbal", 0, "Ce cuvânt este opusul lui „a amplifica”?", ["a mări", "a diminua", "a repeta", "a ascunde"], 1, "A amplifica înseamnă a mări, opusul este a diminua."],
        ["tipare", 0, "Ce număr urmează? 2, 3, 5, 9, 17, …", ["25", "31", "33", "34"], 2, "Diferențele se dublează: 1, 2, 4, 8, apoi 16. 17 + 16 = 33."],
        ["numeric", 0, "Câte numere de la 1 la 50 se împart exact la 3 sau la 5?", ["21", "23", "26", "29"], 1, "16 se împart la 3, 10 la 5, iar 3 dintre ele (15, 30, 45) sunt numărate de două ori: 16 + 10 − 3 = 23."],
        ["logica", 0, "Cinci prieteni stau la rând. Filip este primul, Gabi este ultima. Dan nu este nici primul, nici ultimul. Ema stă imediat după Dan. Horia stă înaintea lui Dan. Pe ce loc stă Horia?", ["Al doilea", "Al treilea", "Al patrulea", "Nu se poate ști"], 0, "Rândul este Filip, Horia, Dan, Ema, Gabi."],
        ["verbal", 0, "Sculptor este pentru daltă ce este chirurg pentru…", ["spital", "pacient", "bisturiu", "operație"], 2, "Dalta este unealta sculptorului, bisturiul este unealta chirurgului."],
        ["tipare", 0, "Ce pereche urmează? AZ, BY, CX, …", ["DV", "DW", "EW", "DX"], 1, "Prima literă merge înainte în alfabet, a doua înapoi: DW."],
        ["numeric", 0, "Arunci două zaruri. Care este probabilitatea ca suma lor să fie 7?", ["1 din 12", "1 din 9", "1 din 6", "1 din 4"], 2, "Din 36 de combinații, 6 dau suma 7: 6 din 36 înseamnă 1 din 6."],
        ["logica", 0, "Un ceas rămâne în urmă cu 5 minute în fiecare oră. Îl potrivești la 12:00. Ce oră arată când ora reală este 18:00?", ["17:25", "17:30", "17:35", "18:30"], 1, "În 6 ore pierde 30 de minute, deci arată 17:30."],
        ["verbal", 0, "„Niciun câștig fără efort.” Care afirmație spune același lucru?", ["Orice efort aduce câștig.", "Dacă ai câștigat, ai depus efort.", "Dacă ai depus efort, ai câștigat.", "Câștigul vine fără efort."], 1, "Propoziția spune că nu există câștig fără efort, adică orice câștig a cerut efort."],
        ["numeric", 0, "Pui 1.000 de lei la o dobândă de 10% pe an, iar dobânda se adaugă la sumă. Cât ai după doi ani?", ["1.100 de lei", "1.200 de lei", "1.210 lei", "1.221 de lei"], 2, "După primul an ai 1.100 de lei, iar 10% din 1.100 înseamnă încă 110."],
        ["logica", 0, "O vază s-a spart. Andrei spune: „Nu eu am spart-o.” Bianca spune: „Cristi a spart-o.” Cristi spune: „Bianca minte.” Doar unul dintre ei spune adevărul. Cine a spart vaza?", ["Andrei", "Bianca", "Cristi", "Nu se poate ști"], 0, "Dacă a spart-o Andrei, el și Bianca mint, iar Cristi spune adevărul: exact unul. În celelalte două cazuri ar spune adevărul doi copii."]
      ])
    },

    emotional: {
      type: "likert",
      dims: [
        dim("calm", "Calm sub presiune", "munca", true, "Cum te ții când lucrurile se aglomerează.",
          "Presiunea ajunge repede la tine. Termenele strânse și imprevizibilul te consumă mai mult decât ai vrea.",
          "Faci față presiunii obișnuite, dar perioadele lungi de stres își lasă urma.",
          "Gândești limpede și când e agitație în jur. Presiunea te mobilizează, nu te blochează.",
          "Împarte orice sarcină mare în pași de 20 de minute. Un pas mic terminat liniștește mai bine decât un plan mare.",
          "Gândești limpede sub presiune.",
          "Când te simți sub presiune, oprește-te un minut și respiră rar înainte să continui."),
        dim("reglare", "Stăpânirea emoțiilor", "relatii", true, "Ce faci cu o emoție puternică după ce a apărut.",
          "Emoțiile puternice te iau pe sus și se văd imediat. Îți trebuie timp ca să te aduni.",
          "De cele mai multe ori îți stăpânești reacțiile. Îți scapă doar lucrurile care te ating cu adevărat.",
          "Simți emoția, dar tu alegi ce faci cu ea. Poți aștepta momentul potrivit ca să vorbești.",
          "Dă emoției un nume înainte să reacționezi: „simt furie”, „simt dezamăgire”. Numele îi ia din putere.",
          "Alegi cum reacționezi, chiar și la emoții puternice.",
          "Azi, înainte de un răspuns la nervi, spune-ți în gând ce simți."),
        dim("autocontrol", "Autocontrol", "munca", true, "Cât de bine reziști impulsului de moment.",
          "Acționezi repede, din impuls. Asta îți aduce spontaneitate, dar și vorbe sau cumpărături regretate.",
          "De obicei te gândești înainte, dar tentațiile bune te mai prind.",
          "Te gândești la urmări înainte să acționezi și termini ce ai început, chiar fără chef.",
          "Pentru orice decizie din impuls, pune o regulă de 24 de ore: dacă mâine o mai vrei, o faci.",
          "Te gândești la urmări și termini ce începi.",
          "Amână cu o zi o cumpărătură sau o decizie luată din impuls."),
        dim("rezilienta", "Revenire după greutăți", "", true, "Cât de repede te ridici după un eșec.",
          "Un eșec sau o critică rămân mult cu tine. Îți ia timp să o iei de la capăt.",
          "Te afectează ce merge prost, dar îți revii. Uneori ai nevoie de un imbold de la cineva.",
          "Te ridici repede după o căzătură și cauți ce poți învăța din ea.",
          "După ceva ce a mers prost, scrie două rânduri: ce a ținut de tine și ce nu. Schimbi doar prima parte.",
          "Te ridici repede după un eșec.",
          "Amintește-ți un eșec mai vechi și notează un lucru bun care a venit din el."),
        dim("constient", "Înțelegerea propriilor emoții", "relatii", true, "Cât de bine știi ce simți și de ce.",
          "Îți dai seama mai greu ce simți și de unde vine. Uneori afli de la alții că ești sub stres.",
          "De obicei știi ce simți, dar cauza îți scapă câteodată.",
          "Știi ce simți, de ce și cum îți schimbă asta deciziile.",
          "Seara, răspunde în scris la o singură întrebare: „Ce am simțit cel mai tare azi și când?”",
          "Știi ce simți și de ce.",
          "Oprește-te de trei ori azi și întreabă-te: „Ce simt acum?”")
      ],
      questions: likert("em", 10, [
        ["calm", 1, "Îmi păstrez calmul când lucrurile nu merg cum am plănuit."], ["reglare", 1, "Când mă înfurii, reușesc să mă liniștesc înainte să vorbesc."],
        ["autocontrol", -1, "Spun lucruri pe care le regret mai târziu."], ["rezilienta", 1, "După un eșec, îmi revin repede."],
        ["constient", 1, "Știu de obicei de ce mă simt așa cum mă simt."], ["calm", -1, "Intru ușor în panică atunci când am mai multe lucruri de făcut deodată."],
        ["reglare", -1, "Emoțiile puternice mă copleșesc și nu mai pot face nimic altceva."], ["autocontrol", 1, "Mă gândesc la urmări înainte să iau o decizie importantă."],
        ["rezilienta", -1, "Când ceva merge prost, mă gândesc la asta zile întregi."], ["constient", -1, "Mi-e greu să pun în cuvinte ce simt."],
        ["calm", 1, "Sub presiune, gândesc la fel de limpede ca de obicei."], ["reglare", 1, "Știu ce să fac ca să-mi schimb starea când am o zi tristă."],
        ["autocontrol", -1, "Cumpăr lucruri din impuls."], ["rezilienta", 1, "Greutățile prin care am trecut mi-au dat putere."],
        ["constient", 1, "Observ repede când începe să mi se schimbe starea."], ["calm", -1, "Un termen-limită apropiat îmi strică somnul."],
        ["reglare", -1, "Rămân cu supărarea mult timp după o ceartă."], ["autocontrol", 1, "Pot rezista unei tentații dacă știu că îmi face rău."],
        ["rezilienta", -1, "Mi-e greu să o iau de la capăt după o dezamăgire."], ["constient", -1, "Uneori sunt într-o stare proastă fără să știu de ce."],
        ["calm", 1, "Pot lucra bine chiar și când cei din jur sunt agitați."], ["reglare", 1, "Pot să-mi amân reacția până când găsesc momentul potrivit."],
        ["autocontrol", -1, "Renunț repede când ceva devine plictisitor."], ["rezilienta", 1, "Găsesc ceva bun chiar și în situațiile grele."],
        ["constient", 1, "Îmi dau seama cum îmi influențează emoțiile deciziile."], ["calm", -1, "Lucrurile mărunte care merg prost îmi strică toată ziua."],
        ["reglare", -1, "Când mă enervez, se vede imediat pe fața mea."], ["autocontrol", 1, "Termin ce am început, chiar dacă îmi pierd cheful."],
        ["rezilienta", -1, "O critică mă descurajează pentru mult timp."], ["constient", -1, "Aflu de la alții că sunt sub stres, înainte să-mi dau seama."]
      ])
    },

    dark: {
      type: "likert",
      // Trăsături descrise neutru: aici nu există scor „bun” sau „rău”, deci nu intră la puncte forte.
      dims: [
        dim("admiratie", "Nevoia de a străluci", "", false, "Cât de mult contează pentru tine să te vadă și să te aprecieze ceilalți.",
          "Nu ai nevoie de aplauze. Preferi ca munca să vorbească pentru tine, iar laudele în public te stânjenesc.",
          "Aprecierea îți face plăcere, dar nu alergi după ea.",
          "Îți place să fii în față și știi ce valoare ai. Aprecierea celorlalți îți dă energie.",
          "Verifică din când în când: fac asta pentru că îmi place, sau ca să fiu în văzul lumii?",
          "Ai încredere în valoarea ta.",
          "Laudă azi pe cineva pentru ceva concret."),
        dim("strategie", "Gândire strategică", "", false, "Cât de mult calculezi atunci când vrei să obții ceva.",
          "Joci cu cărțile pe față. Spui ce vrei și ai încredere că oamenii sunt bine intenționați.",
          "Mergi de obicei pe drumul drept, dar știi să alegi momentul și cuvintele când miza e mare.",
          "Gândești cu câțiva pași înainte. Alegi ce spui, cui și când, ca să ajungi unde vrei.",
          "Strategia câștigă pe termen lung doar împreună cu încrederea. Întreabă-te: m-aș simți bine dacă celălalt ar ști exact ce urmăresc?",
          "Gândești cu câțiva pași înainte.",
          "Într-o discuție de azi, spune deschis ce urmărești."),
        dim("detasare", "Sânge rece", "", false, "Cât de puțin te clatină emoțiile și riscul.",
          "Te afectează ce simt ceilalți și eviți riscurile inutile. Vinovăția te ține în frâu.",
          "Poți lua decizii grele, dar nu fără să te coste. Riscul îți place în doze mici.",
          "Îți păstrezi sângele rece când alții se pierd și iei decizii grele fără să te macine. Îți plac riscul și senzațiile tari.",
          "Sângele rece e un atu în criză. În relații, compensează-l întrebând din când în când: „Tu cum te simți cu asta?”",
          "Îți păstrezi sângele rece în situații de criză.",
          "Întreabă azi pe cineva apropiat cum se simte și ascultă până la capăt.")
      ],
      questions: likert("dk", 6, [
        ["admiratie", 1, "Îmi place să fiu în centrul atenției."], ["strategie", 1, "Nu spun tot ce știu, dacă asta mă avantajează."],
        ["detasare", 1, "Îmi păstrez sângele rece în situații care îi sperie pe alții."], ["admiratie", 1, "Cred că merit mai mult decât primesc de obicei."],
        ["strategie", -1, "Spun deschis ce urmăresc, chiar dacă asta mă dezavantajează."], ["detasare", -1, "Mă simt vinovat mult timp după ce am rănit pe cineva, chiar fără să vreau."],
        ["admiratie", -1, "Laudele în public mă stânjenesc."], ["strategie", 1, "Înainte să cer ceva, mă gândesc cum să prezint lucrurile ca să primesc un „da”."],
        ["detasare", 1, "Pot lua decizii grele fără să mă afecteze prea mult."], ["admiratie", 1, "Știu că am calități pe care puțini le au."],
        ["strategie", 1, "E bine să știi punctele slabe ale celorlalți."], ["detasare", 1, "Îmi plac riscul și senzațiile tari."],
        ["admiratie", 1, "Mă deranjează când meritele mele trec neobservate."], ["strategie", 1, "Aleg oamenii de care mă apropii și după cât mă pot ajuta."],
        ["detasare", 1, "Problemele altora mă lasă, de cele mai multe ori, rece."], ["admiratie", -1, "Nu am nevoie ca ceilalți să-mi observe reușitele."],
        ["strategie", -1, "Cred că majoritatea oamenilor sunt bine intenționați."], ["detasare", -1, "Mă gândesc mult la cum se simt ceilalți din cauza mea."],
        ["admiratie", 1, "Îmi place ca lumea să mă admire."], ["strategie", 1, "Uneori trebuie să ocolești regulile ca să ajungi unde vrei."],
        ["detasare", 1, "Mă plictisesc repede dacă nu se întâmplă nimic palpitant."], ["admiratie", 1, "Într-un grup, de obicei eu ies în evidență."],
        ["strategie", 1, "Am răbdare să aștept momentul potrivit ca să obțin ce vreau."], ["detasare", 1, "Dacă cineva mă supără, nu uit ușor."],
        ["admiratie", -1, "Prefer ca altcineva să primească laudele."], ["strategie", -1, "Nu aș flata pe cineva doar ca să obțin ceva."],
        ["detasare", -1, "Evit situațiile periculoase, chiar dacă par interesante."]
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
        dim("decizie", "Luarea deciziilor", "munca", true, "Cât de repede și de ferm hotărăști.",
          "Cântărești mult înainte să hotărăști și te mai răzgândești. Rareori iei o decizie pripită.",
          "Decizi rezonabil de repede, dar la mizele mari ai nevoie de timp.",
          "Hotărăști repede, mergi până la capăt și îți asumi rezultatul.",
          "Pentru deciziile mici, dă-ți o limită de două minute. Păstrează cântăritul pentru cele care chiar contează.",
          "Decizi repede și îți asumi rezultatul.",
          "Ia azi, în două minute, o decizie pe care o tot amâni."),
        dim("risc", "Asumarea riscului", "munca", true, "Cât de bine te simți când nu știi cum se termină.",
          "Preferi siguranța. Alegi câștigul mic și sigur și eviți situațiile fără final clar.",
          "Riști când ai făcut calculele și ai un plan de rezervă.",
          "Nesiguranța nu te sperie. Ai renunța la ceva sigur pentru o idee în care crezi.",
          "Încearcă riscuri mici, cu pierdere limitată: un experiment de o săptămână, nu o schimbare de viață.",
          "Ai curaj să încerci lucruri cu final nesigur.",
          "Fă azi un lucru mic al cărui rezultat nu îl poți prevedea."),
        dim("disciplina", "Disciplină", "munca", true, "Cât de bine te ții de un plan pe termen lung.",
          "Lucrezi în salturi, când vine cheful sau termenul. Obiectivele lungi își pierd repede farmecul.",
          "Te ții de plan cât timp vezi rezultate. Fără ele, motivația scade.",
          "Muncești la fel și când nu te vede nimeni. Te ții de plan și de promisiuni.",
          "Leagă un obicei nou de unul vechi: „după cafea, lucrez 15 minute la proiect”.",
          "Te ții de plan și de cuvânt.",
          "Lucrează azi 15 minute la un obiectiv pe termen lung, fără întreruperi."),
        dim("influenta", "Influență", "munca", true, "Cât de ușor îi convingi și îi motivezi pe ceilalți.",
          "Nu îți place să dai indicații și nu insiști când cineva nu e de acord.",
          "Convingi oamenii care te cunosc. Cu ceilalți îți ia mai mult.",
          "Oamenii te ascultă. Explici limpede și știi cum să ridici moralul cuiva.",
          "Înainte să convingi pe cineva, află ce își dorește el. Apoi arată-i legătura cu ideea ta.",
          "Explici limpede și îi motivezi pe ceilalți.",
          "Explică azi cuiva o idee de-a ta în trei propoziții.")
      ],
      questions: likert("ld", 10, [
        ["initiativa", 1, "Dacă văd o problemă, mă apuc să o rezolv fără să aștept să mi se ceară."], ["decizie", 1, "Iau decizii repede, chiar și când nu am toate informațiile."],
        ["risc", 1, "Aș renunța la un loc de muncă sigur pentru o idee în care cred."], ["disciplina", 1, "Îmi fac un plan și mă țin de el."],
        ["influenta", 1, "Oamenii îmi urmează de obicei sfaturile."], ["initiativa", -1, "Prefer să primesc instrucțiuni clare decât să hotărăsc eu ce e de făcut."],
        ["decizie", -1, "Amân deciziile importante cât pot de mult."], ["risc", -1, "Prefer un câștig mic și sigur unuia mare, dar nesigur."],
        ["disciplina", -1, "Las lucrurile pe ultima clipă."], ["influenta", -1, "Mi-e greu să conving pe cineva care nu e de acord cu mine."],
        ["initiativa", 1, "Propun des idei noi în grupurile din care fac parte."], ["decizie", 1, "După ce am hotărât ceva, merg până la capăt."],
        ["risc", 1, "Văd eșecul ca pe o lecție, nu ca pe o rușine."], ["disciplina", 1, "Muncesc la fel de serios și când nu mă verifică nimeni."],
        ["influenta", 1, "Știu cum să motivez un om care și-a pierdut cheful."], ["initiativa", -1, "Aștept ca altcineva să facă primul pas."],
        ["decizie", -1, "Mă răzgândesc des după ce am luat o decizie."], ["risc", -1, "Evit situațiile în care nu știu cum se va termina."],
        ["disciplina", -1, "Îmi pierd repede interesul pentru obiectivele pe termen lung."], ["influenta", -1, "Nu mă simt bine când trebuie să dau indicații altora."],
        ["initiativa", 1, "Încep proiecte din proprie inițiativă."], ["decizie", 1, "Îmi asum răspunderea pentru deciziile mele, chiar și când ies prost."],
        ["risc", 1, "Aș pune timp și bani în ceva nesigur, dacă are potențial."], ["disciplina", 1, "Îmi respect promisiunile, chiar și când nu-mi mai convine."],
        ["influenta", 1, "Pot explica o idee complicată pe înțelesul oricui."]
      ])
    },

    relations: {
      type: "likert",
      dims: [
        dim("comunicare", "Comunicare deschisă", "relatii", true, "Cât de ușor spui ce simți și ce te deranjează.",
          "Ții multe pentru tine și speri să se înțeleagă de la sine. Discuțiile incomode le amâni.",
          "Spui ce ai de spus când contează, dar lucrurile mici le lași să treacă.",
          "Spui ce simți și ce te deranjează, fără ocolișuri. Întrebi în loc să presupui.",
          "Înlocuiește „nu am nimic” cu o propoziție care începe cu „M-a deranjat când…”.",
          "Spui deschis ce simți și întrebi în loc să presupui.",
          "Spune azi cuiva apropiat un lucru pe care îl ții de mult pentru tine."),
        dim("limite", "Limite personale", "relatii", true, "Cât de bine îți aperi timpul și nevoile.",
          "Spui „da” ca să nu superi și pui nevoile celuilalt înaintea alor tale.",
          "Îți aperi limitele cu cei mai mulți oameni, dar cedezi în fața celor dragi.",
          "Poți spune „nu” fără vinovăție și spui clar ce nu accepți.",
          "Când ți se cere ceva, răspunde întâi „mă gândesc și îți spun”. Câștigi timp să vezi dacă chiar vrei.",
          "Știi să spui „nu” și să îți aperi timpul.",
          "Spune azi „nu” unui lucru pe care l-ai face doar din obligație."),
        dim("conflict", "Gestionarea conflictelor", "relatii", true, "Cum te porți când nu sunteți de acord.",
          "Într-o ceartă vrei să câștigi. Ridici tonul sau aduci în discuție supărări vechi.",
          "De obicei cauți o soluție, dar la nervi îți mai scapă câte un reproș.",
          "Asculți și partea cealaltă, îți ceri iertare când greșești și cauți o soluție bună pentru amândoi.",
          "La următoarea ceartă, repetă întâi cu vorbele tale ce a spus celălalt. Abia apoi răspunde.",
          "Cauți soluții bune pentru amândoi.",
          "Cere-ți iertare pentru un lucru mic pe care l-ai lăsat nespus."),
        dim("apropiere", "Nevoia de apropiere", "", false, "De cât timp împreună și de câtă afecțiune ai nevoie.",
          "Ai nevoie de mult spațiu al tău. Iubești fără să simți nevoia să fiți mereu împreună.",
          "Îți plac și timpul în doi, și timpul doar al tău. Echilibrul contează.",
          "Ai nevoie de mult timp împreună și îți arăți des afecțiunea.",
          "Aici nu există un nivel „corect”. Contează să îi spui partenerului de cât timp împreună și de cât spațiu ai nevoie.",
          "Îți arăți des afecțiunea.",
          "Spune-i cuiva drag de ce ai nevoie săptămâna asta: timp împreună sau timp pentru tine."),
        dim("incredere", "Încredere", "relatii", true, "Cât de ușor te bazezi pe oameni și te deschizi.",
          "Te deschizi greu și verifici ce ți se spune. Teama de dezamăgire te ține în gardă.",
          "Ai încredere în cei apropiați, dar pe oamenii noi îi verifici întâi.",
          "Pornești de la încredere și te deschizi ușor în fața celor dragi.",
          "Încrederea se construiește în pași mici. Împărtășește un lucru mărunt și vezi ce face celălalt cu el.",
          "Te deschizi ușor și te bazezi pe oameni.",
          "Cere azi ajutorul cuiva într-o chestiune măruntă.")
      ],
      questions: likert("rl", 10, [
        ["comunicare", 1, "Spun ce mă deranjează, în loc să aștept să se ghicească."], ["limite", 1, "Pot spune „nu” fără să mă simt vinovat."],
        ["conflict", 1, "Într-o ceartă, încerc să înțeleg și punctul de vedere al celuilalt."], ["apropiere", 1, "Am nevoie să petrec mult timp cu omul drag."],
        ["incredere", 1, "Am încredere în oameni până la proba contrarie."], ["comunicare", -1, "Evit discuțiile incomode, chiar dacă sunt necesare."],
        ["limite", -1, "Accept lucruri care nu-mi convin, ca să nu supăr pe nimeni."], ["conflict", -1, "Când mă cert, aduc în discuție și supărări mai vechi."],
        ["apropiere", -1, "Mă sufocă atunci când cineva vrea să fim mereu împreună."], ["incredere", -1, "Mă tem că oamenii apropiați mă vor dezamăgi."],
        ["comunicare", 1, "Îmi este ușor să vorbesc despre ce simt."], ["limite", 1, "Îmi păstrez timpul pentru mine, chiar și într-o relație apropiată."],
        ["conflict", 1, "Pot să-mi cer iertare când am greșit."], ["apropiere", 1, "Îmi arăt afecțiunea des, prin gesturi sau cuvinte."],
        ["incredere", 1, "Pot să mă bazez pe ceilalți când am nevoie."], ["comunicare", -1, "Când mă supăr, tac și aștept să treacă."],
        ["limite", -1, "Pun nevoile celuilalt înaintea alor mele, aproape de fiecare dată."], ["conflict", -1, "Într-o ceartă, vreau mai ales să am dreptate."],
        ["apropiere", -1, "Prefer să-mi rezolv problemele fără să le împart cu cineva."], ["incredere", -1, "Verific dacă ceea ce mi se spune este adevărat."],
        ["comunicare", 1, "Întreb, în loc să presupun ce gândește celălalt."], ["limite", 1, "Spun clar ce comportamente nu accept."],
        ["conflict", 1, "Caut o soluție bună pentru amândoi, nu doar pentru mine."], ["apropiere", 1, "Îmi place să știu ce face celălalt de-a lungul zilei."],
        ["incredere", 1, "Îmi este ușor să mă deschid în fața cuiva drag."], ["comunicare", -1, "Mi se întâmplă să spun „nu am nimic” când de fapt am."],
        ["limite", -1, "Mi-e greu să cer ceva pentru mine."], ["conflict", -1, "Ridic tonul când simt că nu mi se dă ascultare."],
        ["apropiere", -1, "Am nevoie de mult timp doar pentru mine ca să mă simt bine."], ["incredere", -1, "Gelozia îmi dă bătăi de cap."]
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
