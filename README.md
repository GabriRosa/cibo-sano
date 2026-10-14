# Cibo sano

Diario alimentare in italiano con 195 ricette pubbliche, installabile su Android e consultabile offline. Registra colazione, spuntino, pranzo e cena con kcal, proteine, carboidrati e grassi, e tiene separata l'acqua bevuta. Puoi impostare obiettivi con una data di decorrenza, salvare prodotti e versioni personali delle ricette, pianificare il menu settimanale e preparare la spesa dalla dispensa. La sezione Peso conserva le pesate e ne mostra l’andamento nel tempo. Le ricette provengono da fonti Instagram, recuperi dai video e proposte con ingredienti pesati.

L'app usa HTML, CSS e JavaScript, senza server applicativo, account o strumenti di analisi. Lo scanner dei codici a barre usa l'API nativa del browser quando disponibile, altrimenti una copia locale di ZXing. Il lettore delle foto delle etichette usa Tesseract sul dispositivo, dopo il download iniziale. GitHub Pages distribuisce i file della cartella principale. Non serve acquistare un dominio. La gratuità dipende dalle condizioni e dai limiti del piano GitHub utilizzato.

## Sul telefono

Apri l'indirizzo dell'app in Chrome, poi usa **Menu ⋮ → Aggiungi a schermata Home → Installa**. La voce può variare con la versione del browser.

Al primo accesso online attendi l'indicazione “Pronto anche offline”. In seguito puoi leggere le ricette senza rete. I link alle fonti e i video Instagram richiedono una connessione.

I dati personali si salvano nel browser del dispositivo. Usa **Diario → Obiettivi e backup completo → Esporta backup completo** per conservarli e trasferirli su un altro dispositivo. In **Informazioni** resta disponibile l'esportazione dei soli preferiti: contiene gli identificativi delle ricette, non le versioni personali a cui possono riferirsi.

## Diario e alimenti

Dalla home scegli il giorno e **Aggiungi** nel pasto. Puoi selezionare un alimento, una ricetta, cercare un codice a barre o trascrivere un'etichetta. Il catalogo di base riusa gli alimenti già documentati nel ricettario. Ogni valore si riferisce a 100 g; i prodotti inseriti o cercati possono usare 100 ml, con unità confermata dall'utente. Non esiste una conversione automatica fra grammi e millilitri. Gli alimenti fuori catalogo si aggiungono da etichetta.

Dalla scheda di una ricetta, **+ Diario** trasferisce una porzione delle dosi correnti. Se la scheda mostra più porzioni, prima divide il totale per quel numero; il modulo del diario permette poi di registrare quante ne sono state mangiate, anche frazioni. Ogni voce conserva una copia di nutrienti, fonte e ingredienti per porzione: gli aggiornamenti successivi del ricettario non modificano i giorni già registrati. Tocca una voce per cambiarne quantità, giorno o pasto, oppure rimuoverla. Dopo una rimozione puoi annullare l'ultima operazione. Se un'altra finestra modifica la voce mentre il modulo è aperto, il salvataggio e la rimozione vengono fermati: chiudi e riapri la voce per caricare la versione aggiornata.

### Prodotti personali e porzioni

Dal selettore **Alimenti**, apri **I tuoi alimenti e le tue porzioni**. Puoi salvare un prodotto da etichetta senza aggiungerlo a un pasto, modificarlo o rimuoverlo. Nome, unità, kcal e tre macronutrienti descrivono sempre 100 g o 100 ml. Le modifiche valgono per le prossime aggiunte; le voci già registrate conservano i propri valori anche se il prodotto viene rimosso.

Ogni prodotto può avere fino a 20 porzioni con un nome e una quantità, per esempio un vasetto da 125 g. Quando lo aggiungi al diario, scegli una porzione e il numero consumato, anche frazionario: la voce registra la quantità risultante in g o ml. La porzione usa sempre l'unità del prodotto. Se cambi unità nell'editor, devi reinserire le quantità delle porzioni; l'app non converte g in ml.

## Acqua

Nel giorno selezionato del **Diario**, la sezione **Acqua** permette di aggiungere 250 ml, 500 ml o una quantità personalizzata. Il modulo accetta ml e litri, anche con la virgola decimale: 0,3 L corrispondono a 300 ml. Ogni registrazione conserva millilitri interi e una data; puoi modificarla, spostarla a un altro giorno, rimuoverla e annullare l'ultima rimozione. Il limite per una registrazione è da 1 a 10.000 ml: è un limite tecnico, non un obiettivo di consumo.

Il totale del giorno e il riepilogo settimanale usano solo le registrazioni dell'acqua. La media è indicata come **Media sui giorni con acqua registrata**, insieme al numero di giorni considerati. I giorni senza registrazioni mostrano un trattino o **Non registrata** e sono esclusi dalla media. Le spunte **Giornata completa** riguardano il cibo e non cambiano la media dell'acqua. L'app non propone un obiettivo automatico di idratazione.

L'acqua è inclusa nei PDF e nel backup completo. Un giorno con sola acqua rimane senza registrazioni alimentari: non entra nelle medie del cibo.

## Obiettivi e riepilogo settimanale

In **Obiettivi e backup completo**, scegli **Validi dal** e inserisci gli obiettivi di kcal, proteine, carboidrati e grassi. Ogni campo è facoltativo: vuoto significa nessun obiettivo per quel valore. Lasciarli tutti vuoti disattiva gli obiettivi dalla data scelta. Le kcal accettano valori maggiori di zero fino a 10.000; i macro da 0 a 1.000 g. L'app conserva i valori indicati dall'utente e non calcola un piano alimentare.

Un obiettivo resta valido dalla sua data fino al cambio successivo. Aggiungere un cambio non modifica gli obiettivi dei giorni precedenti. Puoi consultare lo storico e correggere una decorrenza già salvata: la correzione si applica a quel periodo. Il precedente obiettivo calorico senza data, se presente, continua a valere prima del primo cambio. I pasti registrati restano invariati. Il riepilogo del giorno mostra il consumo e lo scostamento per ciascun obiettivo impostato.

Spunta **Giornata completa** quando hai registrato tutto. La scelta è manuale e reversibile; puoi ancora correggere i pasti. Il riepilogo della settimana, da lunedì a domenica, distingue:

- **Completa**: giornata segnata dall'utente, inclusa nelle medie.
- **Parziale**: almeno una voce, senza la spunta di completamento.
- **Non registrata**: nessuna voce e nessuna spunta.

Le medie usano solo i giorni completi. Senza giorni completi non viene mostrata una media; un giorno vuoto segnato esplicitamente come completo conta invece come zero. Il totale settimanale e la distribuzione delle calorie fra i pasti includono tutte le voci, anche dei giorni parziali. Il PDF mensile mantiene un criterio diverso, descritto in [Riepiloghi PDF](#riepiloghi-pdf).

## Versioni personali delle ricette

Apri una ricetta, modifica le dosi se necessario e scegli **Salva nuova versione**. L'editor parte dalle quantità correnti divise per il numero di porzioni: i pesi della versione salvata sono per una porzione. Puoi cambiare titolo, ingredienti, grammi, procedimento e note. Per sostituire o aggiungere ingredienti sono disponibili gli alimenti del catalogo e i prodotti personali in grammi; i prodotti in ml restano esclusi perché manca una conversione di densità.

La nuova scheda compare in **Le mie versioni** e conserva una copia dei valori nutrizionali di ogni ingrediente. Modifiche successive al catalogo o ai prodotti personali non ne cambiano i calcoli. La ricetta di partenza resta disponibile; per una successiva variazione puoi salvare un'altra versione. Puoi usare le versioni nel diario e nel menu, aggiungerle ai preferiti o eliminarle. L'eliminazione dal ricettario conserva i pasti già registrati e pianificati, che hanno copie proprie delle dosi e dei valori.

Le versioni personali sono locali e incluse nel backup completo. Il pulsante di condivisione del link è nascosto per queste schede: il loro contenuto non viene pubblicato con il ricettario.

## Menu e lista della spesa

In **Menu**, scegli la settimana e usa **Pianifica una ricetta**, oppure **Aggiungi al menu** dal dettaglio di una ricetta. Scegli giorno, pasto e porzioni da preparare, anche frazionarie. Il piano conserva dosi, nutrienti e fonte per una porzione al momento del salvataggio; cambiare la ricetta in seguito non modifica il piano. Puoi spostare il pasto, cambiare il numero di porzioni o rimuoverlo.

Il menu rappresenta pasti previsti. **Registra nel diario** apre il modulo con data, pasto e quantità del piano: serve confermare il salvataggio per registrare ciò che hai mangiato. Questa operazione conserva il piano e non aggiorna le scorte.

La lista della spesa somma gli ingredienti di tutti i pasti della settimana e moltiplica le dosi per le porzioni. Poi sottrae una sola volta le quantità disponibili in dispensa, senza scendere sotto zero. Le righe sono raggruppate per nome normalizzato e unità; g, ml e pezzi restano distinti. Puoi spuntare gli acquisti: se cambia la quantità da comprare, la riga torna da spuntare. Le spunte non aggiungono scorte alla dispensa.

## Dispensa e suggerimenti

In **Dispensa**, registra un ingrediente con quantità e unità (`g`, `ml` o `pz`). Usa **Da pesare** per una quantità sconosciuta e 0 per un ingrediente terminato. Aggiorna manualmente le scorte quando acquisti o consumi un ingrediente.

Gli abbinamenti richiedono lo stesso nome dopo aver normalizzato maiuscole, accenti e spazi. Non riconoscono sinonimi: ceci cotti e ceci secchi restano alimenti diversi. I nomi suggeriti nel modulo aiutano a usare quelli del ricettario. Una quantità sconosciuta o in un'altra unità viene segnalata, ma non riduce la spesa; non vengono stimate conversioni fra g, ml e pezzi.

**Cosa puoi preparare** confronta le scorte con le dosi per una porzione e mostra fino a sei ricette, dando precedenza a quelle con quantità sufficienti. Ogni proposta considera la stessa dispensa: gli ingredienti non vengono riservati fra proposte diverse. Il selettore del menu e questi suggerimenti escludono le ricette con tofu.

## Archivio locale e backup completo

**Esporta backup completo** scarica un JSON con diario, acqua, prodotti e porzioni, pesate, obiettivi, giorni completi, versioni delle ricette, preferiti, menu, dispensa e spunte della spesa. L'interfaccia indica l'ultima esportazione avviata su quel dispositivo e ricorda di ripeterla dopo sette giorni. Controlla che il file sia nei download e conservalo privatamente.

**Importa backup** accetta il formato `cibo-sano-full-v1` e il precedente `cibo-sano-diary-v1`, fino a 15 MB. Prima mostra il contenuto; **Unisci ai dati del dispositivo** conferma l'importazione. L'app valida l'intero file e il risultato della fusione prima di salvare l'archivio. Un file non valido non produce scritture parziali.

L'importazione aggiunge gli elementi mancanti. Conserva i dati locali per ID coincidenti di voci del diario, registrazioni dell'acqua, prodotti, versioni, pasti pianificati e scorte; per date coincidenti delle pesate e degli obiettivi; per la stessa settimana, nome normalizzato e unità delle spunte della spesa. Il precedente obiettivo calorico locale prevale se già definito. Preferiti e date dei giorni completi vengono uniti senza duplicati. Non elimina dati locali assenti nel file importato.

L'archivio usa `localStorage`, chiave `cibo-sano:diary:v1`, con `schemaVersion: 1`. I campi sono validati in [diary.mjs](diary.mjs) e nei moduli indicati sotto. I campi aggiunti sono facoltativi, così i diari precedenti restano leggibili.

| Campo | Contenuto |
| --- | --- |
| `entries`, `foods`, `goal` | Voci con valori propri, prodotti personali e precedente obiettivo calorico (`null` se assente); le porzioni facoltative sono in `foods[].portions` |
| `weights` | Pesate per data; facoltativo nei dati precedenti |
| `waterEntries` | Registrazioni con `id`, `date`, `ml`, `createdAt` e `updatedAt`; validazione e riepiloghi in [water.mjs](water.mjs). Campo facoltativo nei dati precedenti |
| `targets`, `completeDays` | Obiettivi per decorrenza e date dei giorni completi, gestiti da [targets.mjs](targets.mjs) |
| `personalRecipes`, `favorites` | Versioni con valori nutrizionali negli ingredienti e ID preferiti, gestiti da [personal-recipes.mjs](personal-recipes.mjs) |
| `plans`, `pantry`, `shoppingChecks` | Pasti previsti con dosi e nutrienti per porzione, scorte e spunte per settimana, gestiti da [kitchen.mjs](kitchen.mjs) |

Se `favorites` manca, la lettura recupera i preferiti validi dalla precedente chiave `cibo-sano:favorites:v1`; il successivo salvataggio li include nell'archivio unico. Un campo facoltativo assente viene trattato come vuoto; un campo presente ma non valido causa il rifiuto dei dati.

Le scritture sono serializzate con Web Locks nei browser che lo supportano; negli altri il ciclo lettura/scrittura non garantisce l'assenza di conflitti fra finestre contemporanee. Gli editor rilevano modifiche concorrenti alle voci, all'acqua, ai prodotti, alle pesate, agli obiettivi e ai record di menu e dispensa. Errori di quota o accesso non vengono mostrati come salvataggi riusciti. Un archivio corrotto resta conservato ed è esportabile come copia di recupero.

I dati personali non vengono caricati nel repository, inclusi nel link pubblico o sincronizzati fra dispositivi. Cancellare i dati del browser può eliminarli. Le foto delle etichette e il testo OCR temporaneo non sono inclusi nel backup: vengono salvati solo i valori confermati del prodotto.

## Peso nel tempo

La sezione **Peso** registra una pesata per giorno con data e chilogrammi. Accetta la virgola decimale, valori da 1 a 500 kg e date fino a oggi; salva al massimo due decimali. Se una data ha già un valore, il modulo lo mostra per aggiornarlo. Dallo storico puoi modificare o rimuovere una pesata e annullare l'ultima rimozione.

I filtri **1 mese**, **3 mesi**, **6 mesi** e **1 anno** selezionano un intervallo che termina oggi e inizia lo stesso giorno del mese iniziale, adattato all'ultimo giorno disponibile quando necessario. Le date ai due estremi sono incluse. Il grafico colloca le misure in base alla distanza tra le date e mostra la scala in kg. La variazione del periodo è la differenza fra l'ultima e la prima pesata disponibili in quell'intervallo; con meno di due misure non viene calcolata. I giorni senza misure restano senza dati. Lo storico consente di leggere i valori anche senza usare il grafico.

Ogni elemento di `weights` contiene `date`, `kg` e `updatedAt`. Le modifiche rilevano se un'altra finestra ha cambiato la stessa pesata dopo l'apertura del modulo. L'annullamento di una rimozione conserva un eventuale nuovo valore già presente per quella data. Salvataggio, backup e funzionamento offline usano lo stesso archivio locale del diario; le pesate non sono pubblicate con l'app. I PDF del diario riepilogano pasti, nutrienti e acqua; non includono le pesate.

## Riepiloghi PDF

In **Esporta riepiloghi PDF**, **Scarica PDF del giorno** usa il giorno selezionato nel diario. Include voci, quantità, kcal e macro, subtotali dei quattro pasti e totale alimentare; la sezione **Acqua** mostra il totale in ml e il numero di registrazioni. Se l'acqua manca, indica **Non registrata**. Puoi esportare anche un giorno con sola acqua: i valori alimentari mostrano un trattino e i quattro pasti risultano non registrati.

Per **Scarica PDF del mese** scegli il mese nel campo dedicato. Il documento inizia con totale alimentare, media sui giorni con almeno una voce alimentare e riepilogo dell'acqua. Una colonna dedicata mostra i ml di ogni giorno. La media dell'acqua usa soltanto i giorni con acqua registrata e indica il proprio denominatore; la media alimentare include i giorni parziali con cibo, indipendentemente dall'acqua e dalle spunte di completamento.

Seguono i dettagli dei giorni con cibo o acqua, ciascuno su una nuova pagina. Colazione, spuntino, pranzo e cena mantengono alimenti o ricette, quantità, kcal, proteine, carboidrati, grassi e subtotali. I pasti senza voci sono indicati come non registrati. Gli elenchi lunghi proseguono sulle pagine successive, mantenendo data e nome del pasto. I giorni senza cibo né acqua hanno trattini nel riepilogo e nessuna pagina di dettaglio. Nei vecchi diari senza `waterEntries`, l'acqua risulta non registrata. Non vengono ricostruiti obiettivi storici.

I numeri provengono dalle copie salvate nelle voci del diario, non dal catalogo corrente. Il calcolo precede l'arrotondamento (kcal intere, macro con un decimale). Il PDF è creato e scaricato nel browser con la copia locale di jsPDF, anche offline una volta completata la cache. Non viene inviato al repository o a un servizio esterno. Per importare i dati in un altro dispositivo serve il backup JSON: il PDF è un riepilogo da leggere o condividere. I font standard conservano le lettere italiane; emoji e caratteri fuori dall'alfabeto Latin-1 sono omessi.

## Codici a barre

Lo scanner legge EAN-13, EAN-8 e UPC-A. Chiede la fotocamera solo dopo **Apri fotocamera**, preferisce la posteriore e arresta lo stream alla lettura, alla chiusura o quando l'app passa in background. Foto e video restano sul dispositivo. Rimane sempre disponibile l'inserimento manuale. Su Android serve un browser compatibile e l'indirizzo HTTPS pubblico.

Il client usa [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) tramite `GET /api/v2/product/{barcode}.json`, con campi selezionati, `credentials: omit`, identificazione pubblica dell'app e timeout di 12 secondi. Questa versione è ancora supportata ma deprecata: un futuro passaggio a v3.6 deve includere il nuovo parser di `product.nutrition`; cambiare solo l'URL non funziona. L'adattatore attuale usa `product.nutriments`, verifica i campi mancanti e non li trasforma in zero. L'energia dichiarata in kJ è convertibile in kcal dividendo per 4,184; non si usa una ricostruzione 4/4/9.

Anche il suffisso `_100g` può indicare valori per 100 ml: la scelta dell'unità è obbligatoria prima del salvataggio. Il prodotto viene sempre mostrato per controllo, senza registrazione automatica. Una nuova ricerca richiede rete; i prodotti confermati rimangono disponibili nel diario locale e vengono inclusi nel backup. Le risposte già ottenute sono riusate nella sessione. Sono gestiti prodotto assente, dati incompleti, timeout, risposta illeggibile e limite di richieste. Il database collaborativo non garantisce che ogni prodotto esista o sia corretto.

Attribuzione: **Open Food Facts**, link alla scheda prodotto, [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). I dati esterni non vengono fusi nel `recipes.json` pubblico. Per redistribuire un database derivato occorre rispettare anche le condizioni share-alike. Non vengono usate immagini dei prodotti.

Il fallback vendorizzato è `@zxing/browser` 0.2.1, dal [tarball npm ufficiale](https://registry.npmjs.org/@zxing/browser/-/browser-0.2.1.tgz). È caricato dalla stessa origine, non da un CDN; il bundle include `@zxing/library`. Licenze e provenienza sono in [vendor/README.md](vendor/README.md).

## Foto delle etichette

Nel modulo **Da etichetta**, o durante la modifica di un prodotto, scegli **Scegli foto** o **Scatta foto**. Il lettore accetta JPEG, PNG, WebP e BMP fino a 15 MB. Per una foto HEIC serve prima una copia in uno dei formati supportati. Una tabella ritagliata, dritta e ben illuminata facilita la lettura.

L'OCR estrae testo sul dispositivo e propone kcal, proteine, carboidrati e grassi per 100 g o 100 ml. Puoi consultare il testo riconosciuto, correggere i campi e scegliere l'unità. Quando il parser rileva una lettura mancante o ambigua, lascia vuoto il campo. Nelle tabelle per 100 g scarta i singoli macro superiori a 100 g, senza tentare di indovinare un separatore decimale mancante. Non sostituisce carboidrati e grassi totali con zuccheri e saturi, non converte kJ in kcal e non converte valori per porzione in valori per 100.

Prima di salvare dopo una lettura devi selezionare **Ho confrontato e corretto i valori con la confezione**. La lettura può sbagliare; la conferma manuale resta necessaria anche quando tutti i campi sono compilati.

Il primo utilizzo richiede rete per scaricare Tesseract e la lingua italiana dalla stessa origine dell'app, circa 6,8 MB di file prima della compressione HTTP. [label-ocr.mjs](label-ocr.mjs) configura percorsi locali per motore, worker, core e lingua. La foto non viene inviata a un servizio. Il [service worker](sw.js) salva in cache i file OCR richiesti per riusarli offline; non scarica in anticipo tutte le varianti del motore. La cache appartiene alla versione dell'app: dopo un aggiornamento o la cancellazione dei dati può servire un nuovo download. **Pronto anche offline** indica la disponibilità dell'app e del ricettario, non garantisce che il lettore OCR sia già stato scaricato.

Puoi annullare la lettura e inserire i valori a mano. Le copie del motore, i file di licenza e le impronte SHA-256 sono descritti in [vendor/README.md](vendor/README.md).

## Aggiornare le ricette

La fonte dei dati dell'app è [recipes.json](recipes.json). Ogni voce ha un identificativo stabile: mantienilo quando correggi una ricetta, così preferiti e link continuano a funzionare. Per una nuova scheda copia una voce dello stesso tipo e assegna un nuovo `id`.

- `kind: "originale"`: ingredienti nel campo `ingredientText`, passaggi in `steps`, ingredienti e dosi della fonte conservati. I nuovi procedimenti sono sintetizzati senza alterarne i passaggi verificati. Anche queste schede hanno ingredienti strutturati per una porzione e un campo `quantityNote` che descrive dosi stimate, resa e scelte fra alternative. `portionLabel` specifica se la porzione è un piatto, una barretta, una dose di salsa o altro; `batchServings` indica in quante porzioni è stata divisa la preparazione. `sourceRecipeId` collega le varianti alla scheda originale.
- `kind: "porzione"`: ingredienti strutturati con `name`, `grams`, `added` e `note`; base di una persona. `added: true` indica un ingrediente proposto per completare il pasto. Il comando di preparazione aggiorna `kcal` dalla somma degli ingredienti, per la porzione di base.
- `notes`, `author`, `url` e `sourceType` mantengono note e attribuzioni. `extraSource` è un link facoltativo. Le categorie ammesse sono definite in [lib.mjs](lib.mjs).

Con Node.js recente, dalla cartella del progetto:

```sh
node scripts/version.mjs
node --test tests/*.test.mjs
```

Il campo `foods` nello stesso file associa il nome esatto di ogni ingrediente strutturato a kcal, proteine (`protein`), carboidrati (`carbs`) e grassi (`fat`) per 100 g. Ogni voce mantiene fonte, riferimento, URL ed eventuale nota sull'alimento assunto. Una nuova ricetta con dosi deve avere una voce completa per ogni ingrediente.

Il primo comando aggiorna l'identificativo e la data del ricettario se cambia il contenuto. Aggiorna anche la versione della cache offline quando cambiano i file dell'app. Il secondo verifica dati, filtri, calcoli, backup, obiettivi, acqua, menu, dispensa, parser delle etichette e riferimenti alle risorse offline. I test del parser non misurano l'accuratezza dell'OCR su fotografie reali.

Salva le modifiche su Git e inviale al ramo `main`. Con GitHub Pages configurato su **Deploy from a branch → main → / (root)**, ogni aggiornamento del ramo avvia una nuova pubblicazione. La disponibilità effettiva dipende dal completamento della pubblicazione GitHub.

L'app cerca nuove ricette all'apertura online e con il pulsante di aggiornamento. L'aggiornamento dei dati non richiede reinstallazione. Il recupero di nuove ricette da Instagram è un'attività separata: questa app non accede all'account Instagram e non controlla i salvataggi.

## Raccolta Colazioni

Il filtro **Colazioni** seleziona le 52 schede con `collection: "Colazioni"`. Provengono da 43 dei 44 reel esaminati; uno contiene dieci idee, salvate separatamente. Tre reel privi di ingredienti nella descrizione sono stati recuperati dai video e da un commento dell’autore. Il plumcake al limone integra descrizione e passaggi osservati nel video.

Il quarto reel senza ingredienti, “Torta proteica” di `emanuela_malavisi`, rimanda a una ricetta privata e non permette una ricostruzione sufficientemente certa. È segnalato nel riepilogo espandibile della raccolta, con link e motivo, nel campo `collectionNotes`; non ha una scheda con dati inventati. Le incertezze degli altri recuperi sono visibili nelle singole schede.

Le dosi iniziali distinguono ciotole, fette, biscotti e creme. Una porzione di dolce può essere soltanto una parte della colazione. Le quantità mancanti sono stime dichiarate; i prodotti non identificati usano riferimenti nutrizionali espliciti. Le due mousse chia/cacao equivalenti mantengono i rispettivi autori e link.

## Ricette web scelte

Le prime quattro proposte selezionate (jambalaya, chili di tacchino, shakshuka e salmone con broccoli) hanno ID `scelta-fit-02`, `scelta-fit-03`, `scelta-fit-04` e `scelta-fit-06`. Usano `quantityBasis: "adattamento"`: ingredienti pesati e procedimento si riferiscono alla porzione proposta, con accompagnamenti aggiunti dichiarati e compresi nei macro. Il riepilogo della fonte resta in `ingredientText`. I link portano a Good Food o Skinnytaste, con attribuzione senza prefisso Instagram.

Le quattro ricette con zucca hanno ID `zucca-scelta-01`, `zucca-scelta-03`, `zucca-scelta-05` e `zucca-scelta-08`: chili di tacchino, pasta con Delica e ceci, Hokkaido ripiena di lenticchie e tajine di butternut con cous cous. Seguono lo stesso formato di adattamento. Delica, Hokkaido e butternut hanno voci nutrizionali distinte, rispettivamente dalla scheda prodotto Blife, dalla tabella 2 di Bognar (2006) e da CoFID 2021; i link e i limiti dei riferimenti sono in `foods`. I pesi delle zucche sono crudi e al netto degli scarti. L'olio aggiunto alla Hokkaido e il cous cous scelto come accompagnamento della tajine sono compresi nei totali.

## Quantità e valori nutrizionali

Tutte le 195 schede (45 idee, 90 ricette o varianti della prima raccolta, 52 colazioni e 8 ricette web scelte) mostrano kcal e macro per la dose di base anche nell'elenco. Nel dettaglio, ogni campo in grammi modifica il totale con la formula `valore per 100 g × grammi / 100`. Il numero di porzioni scala proporzionalmente le quantità correnti, comprese le modifiche manuali. Da due porzioni in su è visibile anche il totale diviso per il numero di porzioni.

Zero esclude un ingrediente. Campi vuoti, negativi, non numerici o superiori a 10.000 g sospendono il calcolo finché non sono corretti. I decimali accettano punto o virgola. Il pulsante di ripristino torna a una porzione con le dosi proposte. I pesi modificati durano fino alla chiusura della scheda; **Salva nuova versione** li conserva nel ricettario personale. **+ Diario** e **Aggiungi al menu** usano una copia per porzione delle dosi correnti, da confermare nel rispettivo modulo.

I dati provengono da [CoFID 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), Crown copyright, con licenza [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), e dalle etichette dei prodotti indicate in ogni voce. Le tracce CoFID sono conteggiate come zero. Alcuni nomi generici usano un alimento rappresentativo dichiarato nella nota. Lo stato crudo/cotto/sgocciolato deve corrispondere al peso utilizzato. Le energie delle fonti possono differire dal solo calcolo 4/4/9 per fibre, acidi organici e fattori di conversione. Le etichette di marca sono riferimenti, non l'identificazione del prodotto usato dall'utente.

Le 80 schede originali sono ora 90 perché schiscette, crêpes, pranzi e gelati con varianti distinte hanno schede separate. Gli identificativi precedenti restano validi. I pesi mancanti, le conversioni da cucchiai/pezzi e gli alimenti non identificati sono stime dichiarate, non dati ricavati dalla fonte. Le farciture o guarnizioni facoltative escluse sono specificate nella scheda. Il procedimento della fonte non viene ridimensionato automaticamente: può descrivere più porzioni o alternative.

`validData` rifiuta qualsiasi scheda senza ingredienti pesati o senza valori nutrizionali per tutti gli ingredienti. I test verificano la copertura di ogni scheda, le varianti, i totali, le porzioni e il ricalcolo degli ingredienti.

## Anteprima locale

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Apri `http://127.0.0.1:8765`. Usa un server HTTP; l'apertura diretta di `index.html` come file non supporta moduli e service worker. Dopo aver cambiato il codice, esegui `node scripts/version.mjs` e ricarica l'app per aggiornare la cache.

## File e comportamento

| File | Funzione |
| --- | --- |
| [index.html](index.html), [style.css](style.css) | Interfaccia adattata al telefono |
| [app.js](app.js), [lib.mjs](lib.mjs) | Ricerca, filtri, dettagli, dosi e preferiti |
| [diary.mjs](diary.mjs), [diary-ui.js](diary-ui.js), [diary.css](diary.css) | Archivio locale condiviso, validazione, fusione del backup e interfaccia dei pasti |
| [targets.mjs](targets.mjs), [insights-ui.js](insights-ui.js), [insights.css](insights.css) | Obiettivi con decorrenza, giorni completi e riepilogo settimanale |
| [water.mjs](water.mjs), [water-ui.js](water-ui.js), [water.css](water.css) | Registrazioni dell'acqua, totali per giorno/intervallo e interfaccia |
| [personal-recipes.mjs](personal-recipes.mjs), [recipe-versions-ui.js](recipe-versions-ui.js) | Versioni personali con valori nutrizionali conservati e migrazione dei preferiti |
| [backup-ui.js](backup-ui.js), [platform-extras.css](platform-extras.css) | Esportazione completa, anteprima d'importazione e interfaccia delle versioni |
| [kitchen.mjs](kitchen.mjs), [kitchen-ui.js](kitchen-ui.js), [kitchen.css](kitchen.css) | Menu, lista della spesa, dispensa e suggerimenti |
| [portions.mjs](portions.mjs), [label-ocr.mjs](label-ocr.mjs), [food-extras.css](food-extras.css) | Porzioni dei prodotti, lettore e parser locale delle etichette |
| [reports.mjs](reports.mjs), [report-export.js](report-export.js) | Riepiloghi giornalieri/mensili di alimenti e acqua, download PDF locale |
| [weight.mjs](weight.mjs), [weight-ui.js](weight-ui.js), [weight.css](weight.css) | Intervalli del peso, grafico e storico delle pesate |
| [foods.mjs](foods.mjs), [scanner.js](scanner.js), [vendor/](vendor/) | Ricerca prodotti e scanner |
| [recipes.json](recipes.json) | Ricette pubbliche, senza dati del profilo personale |
| [manifest.webmanifest](manifest.webmanifest), [icons/](icons/) | Installazione e icone Android |
| [sw.js](sw.js) | Copia offline dell'app e aggiornamento delle ricette |

Il service worker prova la rete per `recipes.json`; se non riesce usa la copia salvata e segnala che sta mostrando dati locali. I file dell'interfaccia sono salvati insieme nella cache di una versione. I link esterni non vengono scaricati o memorizzati dall'app.

[app.js](app.js) inizializza le interfacce e aggiorna ricettario, diario e menu quando cambia l'archivio locale. I moduli di calcolo [targets.mjs](targets.mjs), [water.mjs](water.mjs), [kitchen.mjs](kitchen.mjs) e [personal-recipes.mjs](personal-recipes.mjs) non importano il diario: [diary.mjs](diary.mjs) ne usa i validatori prima dell'unica scrittura dell'archivio.

L'app e la repository sono pubbliche. Il tag `noindex` chiede ai motori di ricerca di non indicizzare la pagina, ma non limita l'accesso e non garantisce riservatezza. Nei file del repository inserisci soltanto dati destinati alla pubblicazione: niente email, credenziali, diari esportati, profili nutrizionali personali o link alla raccolta privata. Le registrazioni effettuate nell’interfaccia del diario restano invece nel browser.

Le ricette restano attribuite agli autori delle fonti. Le porzioni e le calorie proposte sono stime, separate dalle quantità dell'autore; non costituiscono un piano alimentare individuale.
