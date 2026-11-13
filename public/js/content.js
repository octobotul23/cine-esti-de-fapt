// Valorile implicite ale site-ului: texte, prețuri, setări, lista de teste.
// Tot ce e aici se poate schimba din panoul de administrare (/admin). Panoul salvează pe server,
// iar site-ul pune ce s-a salvat peste aceste valori. Fără server, site-ul arată valorile de aici.
// Întrebările, cheile de răspuns și textele rapoartelor NU sunt aici, ci în server/tests.js,
// pentru că nu trebuie să ajungă în browser înainte de plată.

(function (root) {
  var SITE = {
    settings: {
      siteName: "Cine ești, de fapt?",
      coupleName: "Cât ne cunoaștem?",
      currency: "lei",
      contactEmail: "",
      // Codul monedei, așa cum îl cer procesatorii de plăți (RON, EUR, USD).
      currencyCode: "RON",
      // "test": plata e simulată, nu se ia niciun ban. "real": se încasează prin metodele de mai jos.
      // "oprit": nu se poate plăti (doar coduri de 100%).
      payments: "test",
      // Câți lei face un euro. Se folosește la PayPal, care nu încasează în lei.
      eurRate: 5.1,
      // Metodele de plată, în ordinea în care apar pe pagina de plată. Cheile secrete nu stau aici,
      // ci în variabilele de mediu ale serverului (vezi README).
      pay: {
        methods: [
          { id: "card", name: "Card, Apple Pay sau Google Pay", note: "Plătești pe pagina securizată Stripe. Noi nu vedem datele cardului.", on: true },
          { id: "paypal", name: "PayPal", note: "Plătești din contul tău PayPal. Suma se încasează în euro.", on: false },
          { id: "sms", name: "SMS, pe factura de telefon", note: "Trimiți un SMS. Costul apare pe factură sau se scade din credit.", on: false }
        ],
        // Plata prin SMS are tarife fixe, date de operator. Fiecare produs are numărul scurt și costul lui.
        sms: {
          reply: "Multumim! Accesul a fost deblocat. Intoarce-te pe site.",
          replyBad: "Codul nu a fost recunoscut. Verifica textul de pe pagina de plata si trimite din nou.",
          tariffs: {
            modul: { on: false, number: "", keyword: "", cost: "" },
            cuplu: { on: false, number: "", keyword: "", cost: "" },
            pachet: { on: false, number: "", keyword: "", cost: "" }
          }
        }
      },
      askEmail: true,
      seoTitle: "Cine ești, de fapt? Teste despre tine și despre voi doi",
      seoDescription: "Șapte teste scurte despre personalitate, logică, emoții și relații, plus un test de cuplu. Începi gratis, fără cont.",
      products: {
        modul: { name: "Un test complet", price: 24.99, desc: "Toate întrebările unui test și raportul lui complet.", on: true },
        cuplu: { name: "Testul de cuplu complet", price: 24.99, desc: "Toate cele 30 de întrebări și raportul comun. Plătește unul, vedeți amândoi.", on: true },
        pachet: { name: "Tot pachetul", price: 49.99, desc: "Toate testele despre tine, raportul care le leagă și testul de cuplu.", on: true }
      }
    },

    // Testele din pagina „Cine ești, de fapt?”. Ordinea de aici e ordinea de pe site.
    modules: [
      { id: "bigfive", name: "Personalitate", tagline: "Cele cinci trăsături care te descriu cel mai bine.", on: true },
      { id: "iq", name: "IQ orientativ", tagline: "Logică, calcul, tipare și cuvinte, de la ușor la greu.", on: true },
      { id: "emotional", name: "Profil emoțional", tagline: "Cum îți recunoști emoțiile, ce faci cu ele și cum le spui.", on: true },
      { id: "dark", name: "Latura ta ascunsă", tagline: "Apreciere, strategie și impuls, fără etichete.", on: true },
      { id: "leadership", name: "Leadership", tagline: "Cum iei decizii, cum lucrezi cu ceilalți și cum te adaptezi.", on: true },
      { id: "relations", name: "Relații", tagline: "Cum comunici, cum te cerți și ce vă doriți împreună.", on: true },
      { id: "tarot", name: "Tarot", tagline: "Cartea zilei, cartea ta personală și o etalare de trei cărți.", on: true }
    ],

    // Imaginile site-ului. Se schimbă din panou, din secțiunea Imagini: acolo se încarcă o imagine nouă,
    // iar aici ajunge adresa ei (/media/…). Valorile de mai jos sunt fișierele din public/assets.
    images: {
      heroMan: "/assets/hero-barbat.webp",
      heroWoman: "/assets/hero-femeie.webp",
      heroMind: "/assets/hero-creier.webp",
      logo: "/assets/logo.webp",
      tarotBack: "/assets/tarot-spate.webp"
    },

    home: {
      // Partea de sus a primei pagini
      heroSub: "Crezi că te cunoști? Descoperă ce nu vezi la tine.",
      heroCta: "Începe testul gratuit",
      topicCuplu: "Compatibilitate",
      // Cele trei carduri de sub partea de sus
      euTitle: "Testează-te pe tine",
      euLead: "Șapte teste scurte despre cum gândești, ce simți și cum te porți cu ceilalți.",
      euCta: "Începe cu tine",
      noiTitle: "Testează-ți partenerul",
      noiLead: "Răspundeți amândoi, fiecare de pe telefonul lui, și vedeți cât de bine vă ghiciți.",
      noiCta: "Începeți în doi",
      tarotTitle: "Trage o carte de tarot",
      tarotLead: "Cartea zilei e gratuită. Îți dă o temă la care să te gândești, nu o prezicere.",
      tarotCta: "Deschide tarotul",
      pasiTitle: "Cum merge",
      pasi: [
        { title: "Răspunzi gratis", body: "Fiecare test are o variantă scurtă, gratuită. Durează două-trei minute." },
        { title: "Vezi o parte din rezultat", body: "Îți arătăm pe loc trăsătura care iese cel mai tare în evidență." },
        { title: "Deblochezi raportul complet", body: "Dacă vrei tot, plătești o singură dată. Fără abonament." }
      ],
      moduleTitle: "Ce afli despre tine",
      pretTitle: "Cât costă",
      pretLead: "Începutul e gratuit. Plătești doar dacă vrei raportul complet.",
      // Cardurile de preț. Numele, suma și descrierea vin din Prețuri; aici sunt bifele și butoanele.
      modulPuncte: [
        { text: "Toate întrebările testului ales" },
        { text: "Raportul complet al acelui test" },
        { text: "Te întorci oricând la el, cu linkul tău privat" }
      ],
      modulCta: "Alege un test",
      pachetBadge: "Cel mai bun preț",
      pachetIntro: "Toate cele {n} teste:",
      pachetPuncte: [
        { text: "Raportul care le leagă, cu provocarea de 7 zile" },
        { text: "Testul de cuplu complet, pentru amândoi" },
        { text: "Raport pe care îl poți salva ca PDF" }
      ],
      pachetCta: "Ia tot pachetul",
      cupluPuncte: [
        { text: "Toate cele 30 de întrebări" },
        { text: "Raportul vostru comun" },
        { text: "Plătește unul, vedeți amândoi" }
      ],
      cupluCta: "Începeți în doi",
      pretGratisName: "Varianta scurtă a fiecărui test",
      pretGratisDesc: "Primele întrebări și un rezultat parțial, la toate testele.",
      faqTitle: "Întrebări dese",
      faq: [
        { q: "Chiar e gratis la început?", a: "Da. Varianta scurtă a fiecărui test și rezultatul ei parțial sunt gratuite. Prețul raportului complet îl vezi înainte să începi." },
        { q: "Ce este testul rapid?", a: "Zece întrebări amestecate, de vreo două minute, complet gratuite. La final vezi câte ai nimerit, ce spun alegerile tale și cu ce test merită să continui. Răspunsurile de la testul rapid nu se păstrează." },
        { q: "Trebuie să îmi fac cont?", a: "Nu. Primești un link privat cu care te întorci oricând la rezultatele tale. Nu îți cerem nume sau parolă." },
        { q: "Cât durează?", a: "Varianta scurtă a unui test durează două-trei minute. Cea completă, între cinci și zece minute, iar la IQ orientativ în jur de douăzeci. Poți face testele pe rând, în zile diferite." },
        { q: "Cum merge testul de cuplu?", a: "Tu răspunzi primul, apoi îi trimiți partenerului un link pe WhatsApp. El răspunde separat, de pe telefonul lui. Rezultatul apare doar după ce ați răspuns amândoi." },
        { q: "Partenerul îmi vede răspunsurile?", a: "Da, în raportul comun, după ce a răspuns și el. Înainte de asta, niciunul nu vede ce a ales celălalt." },
        { q: "Cât de exact este IQ-ul orientativ?", a: "Este o estimare făcută din 60 de întrebări, de la ușoare la grele, afișată ca interval. Un IQ real se măsoară doar de un psiholog, cu un test standardizat." },
        { q: "Tarotul îmi spune viitorul?", a: "Nu. Cărțile sunt un joc de reflecție: îți dau o temă la care să te gândești, nu o prezicere." },
        { q: "Am un cod promoțional. Unde îl pun?", a: "În pagina de plată, în câmpul „Cod promoțional”. Reducerea apare înainte să plătești." },
        { q: "Ce se întâmplă cu răspunsurile mele?", a: "Le păstrăm sub un cod, fără numele tău, ca să îți putem arăta raportul. Le poți șterge oricând din pagina „Linkul meu”." }
      ],
      notaTitle: "Ce nu este acest site",
      nota: "Testele sunt un instrument de autocunoaștere. Nu pun diagnostice și nu înlocuiesc discuția cu un psiholog. Cifra de la IQ orientativ este o estimare, nu un IQ măsurat clinic. Tarotul este un joc de reflecție, nu o prezicere."
    },

    // Testul rapid: gratuit, fără link privat. Întrebările lui stau în server/tests.js („quick”) și se schimbă
    // din panou → Test rapid. „on” îl arată sau îl ascunde pe site.
    quick: {
      on: true,
      name: "Testul rapid",
      tagline: "Zece întrebări amestecate, două minute. Gratuit, cu rezultat pe loc.",
      heroLink: "Ai doar două minute? Fă testul rapid",
      resultLead: "Un instantaneu, nu un verdict. Testele complete merg mult mai în adânc.",
      scoreLabel: "Logică, atenție și memorie",
      choicesTitle: "Ce spun alegerile tale",
      reviewTitle: "Răspunsurile corecte",
      nextTitle: "De aici merită să continui",
      nextLead: "După alegerile tale, acesta e testul care ți se potrivește cel mai bine acum.",
      allTests: "Vezi toate testele",
      again: "Fă testul rapid din nou"
    },

    eu: {
      lead: "Fă testele în ce ordine vrei. Fiecare îți dă rezultatul lui, iar raportul final le leagă între ele.",
      raportTitle: "Raportul care le leagă pe toate",
      raportLead: "Punctele tale forte, ce merită să dezvolți și o provocare de 7 zile, scoase din toate testele tale complete.",
      raportCta: "Vezi raportul",
      pachetCta: "Deblochează tot pachetul"
    },

    test: {
      progress: "Întrebarea {n} din {total}",
      likertPrompt: "Cât de bine te descrie?",
      quizPrompt: "Alege un singur răspuns.",
      ownPrompt: "Tu ce alegi?",
      guessPrompt: "Ce crezi că a ales {nume}?",
      sending: "Calculăm rezultatul…"
    },

    rezultat: {
      partialTitle: "Rezultat parțial",
      partialNote: "Ai răspuns la {n} din {total} întrebări. Mai jos vezi ce iese cel mai tare în evidență. Restul apare după testul complet.",
      fullTitle: "Raport complet",
      locked: "Apare în raportul complet",
      unlockTitle: "Vrei să vezi tot?",
      unlockOne: "Deblochează acest test",
      unlockAll: "Deblochează tot pachetul",
      continueLong: "Continuă cu restul întrebărilor",
      backToTests: "Înapoi la teste",
      tipLabel: "Ce poți face",
      iqScore: "Ai rezolvat {n} din {total}",
      iqInterval: "Intervalul tău orientativ",
      iqNote: "Estimare făcută din {total} întrebări. Nu este un IQ măsurat clinic.",
      iqLocked: "Intervalul tău apare după testul complet.",
      reviewTitle: "Răspunsurile tale",
      reviewYours: "Ai ales",
      reviewRight: "Corect"
    },

    raport: {
      title: "Raportul tău",
      missing: "Raportul se completează pe măsură ce termini testele. Mai ai de făcut: {lista}.",
      empty: "Raportul apare după ce termini primul test complet.",
      strengths: "Punctele tale forte",
      growth: "Ce merită să dezvolți",
      work: "La muncă",
      love: "În relații",
      iq: "Cum gândești",
      challenge: "Provocarea ta de 7 zile",
      day: "Ziua {n}",
      cardTitle: "Cardul tău",
      cardQuestion: "Tu ce profil ai?",
      share: "Distribuie cardul",
      download: "Salvează cardul",
      pdf: "Salvează raportul ca PDF"
    },

    tarot: {
      lead: "Trei feluri de a te uita la tine prin cărți. Cartea zilei e gratuită.",
      note: "Tarotul este un joc de reflecție. Nu prezice viitorul și nu ține loc de sfat medical, juridic sau financiar.",
      dayTitle: "Cartea zilei",
      dayHint: "Atinge cartea ca să o întorci.",
      dayAgain: "Mâine te așteaptă altă carte.",
      sens: "Ce înseamnă",
      umbra: "La ce să fii atent",
      sfat: "Sfatul cărții",
      personalTitle: "Cartea ta personală",
      personalLead: "Se calculează din data nașterii. Data nu se păstrează, păstrăm doar cartea care a ieșit.",
      personalName: "Prenumele tău, pentru carte",
      personalDate: "Data nașterii",
      dayLabel: "Zi",
      monthLabel: "Lună",
      yearLabel: "An",
      personalBtn: "Află cartea mea",
      personalChange: "Schimbă data",
      personalShare: "Distribuie cartea",
      personalDownload: "Salvează cartea",
      spreadTitle: "Etalarea de trei cărți",
      spreadLead: "Gândește-te la o întrebare, apoi trage cărțile.",
      spreadBtn: "Trage trei cărți",
      spreadAgain: "Poți trage din nou mâine.",
      unlockLead: "Cartea ta personală și etalarea de trei cărți sunt în varianta completă."
    },

    noi: {
      lead: "Fiecare răspunde despre el și ghicește ce a ales celălalt. La final vedeți cât de bine vă cunoașteți.",
      pasi: [
        { title: "Răspunzi tu", body: "Zece întrebări gratuite despre tine și despre ce crezi că alege partenerul." },
        { title: "Îi trimiți linkul", body: "Pe WhatsApp. Partenerul răspunde separat, de pe telefonul lui." },
        { title: "Vedeți rezultatul", body: "Apare doar după ce ați răspuns amândoi." }
      ],
      nameLabel: "Cum te cheamă? Ajunge prenumele.",
      consent: "Am înțeles că partenerul îmi va vedea răspunsurile în raportul comun.",
      start: "Începe testul",
      mine: "Testele tale în doi",
      open: "Deschide",
      inviteTitle: "Acum e rândul partenerului",
      inviteLead: "Trimite-i linkul. Rezultatul apare după ce răspunde și el.",
      whatsapp: "Trimite pe WhatsApp",
      copy: "Copiază linkul",
      copied: "Link copiat.",
      inviteMsg: "Am făcut un test despre noi doi. Răspunde și tu, să vedem cât de bine ne cunoaștem: {link}",
      waiting: "Aștepți răspunsurile de la {nume}.",
      waitingPartner: "Partenerul nu a deschis încă linkul.",
      yourTurn: "E rândul tău să răspunzi.",
      answer: "Răspunde la întrebări",
      teaserTitle: "Ați răspuns la fel la {n} din {total}",
      teaserLead: "Asta e doar începutul. Raportul complet vă arată cine pe cine cunoaște mai bine, ce vă apropie și unde v-ați surprins.",
      unlock: "Deblochează raportul complet",
      unlockNote: "Plătește unul singur. Raportul se deschide pentru amândoi.",
      continueLong: "Continuă cu cele {n} întrebări rămase",
      paidWaiting: "Raportul complet apare după ce răspundeți amândoi la toate întrebările.",
      reportTitle: "Cât vă cunoașteți",
      same: "Ați ales la fel la {n} din {total} întrebări.",
      knows: "{a} a ghicit {n} din {total} dintre răspunsurile date de {b}.",
      close: "Ce vă apropie",
      talk: "Despre ce merită să vorbiți",
      talkAsk: "Întrebare pentru amândoi",
      surprises: "Unde v-ați surprins",
      surprise: "{a} credea că {b} alege „{ghicit}”. {b} a ales „{real}”.",
      noSurprises: "Nu v-ați surprins deloc. Vă știți pe de rost.",
      cardLine: "Am aflat cât de bine ne cunoaștem. Voi?",
      inviteHead: "{nume} te-a invitat la un test în doi",
      inviteBody: "Răspunzi la aceleași întrebări, separat. La final vedeți cât de bine vă cunoașteți.",
      join: "Răspunde și tu",
      inviteBad: "Linkul de invitație nu mai este valabil. Cere-i partenerului unul nou.",
      inviteSelf: "Acesta este linkul tău de invitație. Trimite-l partenerului.",
      partnerWord: "partenerul tău",
      percent: "V-ați ghicit în {n}% din cazuri"
    },

    plata: {
      title: "Ce deblochezi",
      pickLead: "Alege ce vrei să deblochezi. Poți lua mai multe teste odată.",
      packHint: "Tot pachetul costă mai puțin decât testele alese separat.",
      owned: "Deblocat deja",
      codeLabel: "Cod promoțional",
      codeApply: "Aplică",
      codeOk: "Cod aplicat: {text}",
      discount: "Reducere",
      total: "Total",
      pay: "Plătește {suma}",
      payFree: "Deblochează gratis",
      testNote: "Mod de test. Nu se ia niciun ban și nu se cer datele cardului.",
      off: "Plățile nu sunt pornite încă. Revino curând.",
      methodTitle: "Cum plătești",
      redirecting: "Te ducem pe pagina de plată…",
      confirming: "Verificăm plata…",
      notYet: "Plata nu a fost confirmată încă. Dacă ai plătit, așteaptă câteva secunde și încearcă din nou.",
      checkAgain: "Verifică din nou",
      backToPay: "Înapoi la plată",
      paySms: "Continuă cu SMS",
      smsTitle: "Plata prin SMS",
      smsNumber: "Numărul",
      smsText: "Textul mesajului",
      smsOpen: "Deschide mesajele",
      smsStep: "Trimite un SMS cu textul {text} la numărul {numar}.",
      smsCost: "Cost: {cost}",
      smsWait: "Așteptăm SMS-ul tău. Pagina se deblochează singură, nu o închide.",
      smsSimulate: "Simulează SMS-ul (mod de test)",
      done: "Gata, este deblocat.",
      doneCta: "Mergi mai departe",
      nothing: "Nu ai ales nimic."
    },

    profil: {
      title: "Linkul meu",
      lead: "Acesta este linkul tău privat. Cu el te întorci la rezultate de pe orice telefon sau calculator. Păstrează-l doar pentru tine.",
      empty: "Nu ai început încă niciun test. Linkul apare după primul test.",
      copy: "Copiază linkul",
      mail: "Trimite-mi-l pe e-mail",
      mailSubject: "Linkul meu privat",
      emailTitle: "Vrei noutăți?",
      emailLead: "Lasă-ne adresa doar dacă vrei să primești teste noi și oferte. Nu e nevoie de ea ca să folosești site-ul.",
      emailLabel: "Adresa de e-mail",
      emailConsent: "Sunt de acord să primesc noutăți și oferte pe e-mail.",
      emailSave: "Salvează adresa",
      emailSaved: "Adresa a fost salvată.",
      emailRemove: "Șterge adresa",
      emailRemoved: "Adresa a fost ștearsă.",
      deleteTitle: "Șterge datele mele",
      deleteLead: "Ștergem răspunsurile, rezultatele și adresa de e-mail. Nu se mai pot recupera.",
      deleteBtn: "Șterge tot",
      deleteConfirm: "Sigur ștergi tot? Nu se mai poate recupera.",
      deleted: "Datele au fost șterse.",
      badLink: "Linkul privat nu mai este valabil. Poate datele au fost șterse.",
      switchConfirm: "Pe acest dispozitiv sunt deja alte rezultate. Le înlocuiești cu cele din link?",
      welcomeBack: "Bine ai revenit. Rezultatele tale sunt aici."
    },

    ui: {
      myLink: "Linkul meu",
      navHome: "Acasă",
      navTests: "Teste",
      navCouple: "Cuplu",
      navTarot: "Tarot",
      navPrices: "Prețuri",
      topCta: "Începe gratuit",
      back: "Înapoi",
      loading: "Se încarcă…",
      errorServer: "Nu am putut ajunge la server. Verifică internetul și încearcă din nou.",
      noServer: "Testele nu sunt disponibile acum. Încearcă mai târziu.",
      notFound: "Pagina nu există.",
      home: "Prima pagină",
      retry: "Încearcă din nou",
      free: "Gratis",
      questions: "{n} întrebări",
      cards: "{n} cărți",
      freeQuestions: "{n} gratuite",
      statusNew: "Neînceput",
      statusPartial: "Rezultat parțial",
      statusUnlocked: "Deblocat",
      statusDone: "Complet",
      startFree: "Începe gratis",
      startTest: "Începe testul",
      seeResult: "Vezi rezultatul",
      continueTest: "Continuă testul",
      open: "Deschide",
      privacy: "Confidențialitate",
      terms: "Termeni",
      footNote: "Instrument de autocunoaștere. Nu pune diagnostice.",
      copied: "Copiat."
    },

    legal: {
      privacyTitle: "Confidențialitate",
      privacy: [
        { title: "Ce păstrăm", body: "Răspunsurile tale la teste și rezultatele lor, sub un cod aleator. Nu îți cerem numele. La testul de cuplu păstrăm prenumele pe care îl scrii, ca partenerul să știe cine l-a invitat. La cartea personală de tarot păstrăm prenumele scris și cartea rezultată, nu data nașterii." },
        { title: "Adresa de e-mail", body: "Este opțională. O păstrăm doar dacă o scrii și bifezi că vrei noutăți. O poți șterge oricând din pagina „Linkul meu”." },
        { title: "Fără urmărire", body: "Site-ul nu folosește cookie-uri de reclamă și nu trimite datele tale altor firme. Codul tău privat stă în browserul tău, ca să te recunoaștem când revii." },
        { title: "Testul de cuplu", body: "Răspunsurile tale apar în raportul comun, pe care îl vede și partenerul, după ce a răspuns și el. Dacă unul dintre voi își șterge datele, se șterge și testul comun." },
        { title: "Cât timp", body: "Dacă nu mai revii timp de 12 luni, ștergem singuri răspunsurile și rezultatele." },
        { title: "Drepturile tale", body: "Poți vedea datele în paginile de rezultate și le poți șterge pe toate din pagina „Linkul meu”. Pentru orice altă cerere, scrie-ne la adresa de contact." }
      ],
      termsTitle: "Termeni",
      terms: [
        { title: "Ce este acest site", body: "Un instrument de autocunoaștere și de divertisment. Rezultatele nu sunt diagnostice și nu înlocuiesc sfatul unui psiholog, medic sau alt specialist." },
        { title: "IQ orientativ", body: "Intervalul afișat este o estimare, nu un coeficient de inteligență măsurat cu un test standardizat." },
        { title: "Tarot", body: "Cărțile și textele lor sunt un joc de reflecție. Nu sunt preziceri și nu trebuie folosite pentru decizii medicale, juridice sau financiare." },
        { title: "Plata", body: "Plata se face o singură dată, pentru ce ai ales în pagina de plată. Nu există abonament." },
        { title: "Vârsta", body: "Site-ul este pentru persoane de cel puțin 18 ani." }
      ]
    }
  };

  // Pune valorile salvate peste cele implicite. Obiectele se combină, listele și valorile simple se înlocuiesc.
  function merge(base, over) {
    if (over === undefined) return clone(base);
    if (!isObj(base) || !isObj(over)) return clone(over);
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = k in over ? merge(base[k], over[k]) : clone(base[k]); });
    Object.keys(over).forEach(function (k) { if (!(k in base) && k !== "__proto__" && k !== "constructor" && k !== "prototype") out[k] = clone(over[k]); });
    return out;
  }
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  var api = { SITE: SITE, merge: merge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CUPIDON = api;
})(this);
