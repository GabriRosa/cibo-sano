# Cibo sano

Diario alimentare in italiano con una sezione di 195 ricette, installabile su Android e consultabile offline. La home registra colazione, spuntino, pranzo e cena con kcal, proteine, carboidrati e grassi. Le ricette provengono da fonti Instagram, recuperi dai video e proposte con ingredienti pesati.

L'app usa HTML, CSS e JavaScript, senza server applicativo, account o strumenti di analisi. Lo scanner usa l'API nativa del browser quando disponibile, altrimenti una copia locale di ZXing. GitHub Pages distribuisce i file della cartella principale. Non serve acquistare un dominio. La gratuità dipende dalle condizioni e dai limiti del piano GitHub utilizzato.

## Sul telefono

Apri l'indirizzo dell'app in Chrome, poi usa **Menu ⋮ → Aggiungi a schermata Home → Installa**. La voce può variare con la versione del browser.

Al primo accesso online attendi l'indicazione “Pronto anche offline”. In seguito puoi leggere le ricette senza rete. I link alle fonti e i video Instagram richiedono una connessione.

I preferiti si salvano nel browser del dispositivo. Dalla schermata Informazioni puoi esportarli o importarli; cancellare i dati del browser li elimina. Il backup esportato contiene soltanto gli identificativi delle ricette.

## Diario e alimenti

Dalla home scegli il giorno e **Aggiungi** nel pasto. Puoi selezionare un alimento, una ricetta, cercare un codice a barre o trascrivere un'etichetta. Il catalogo di base riusa gli alimenti già documentati nel ricettario. Ogni valore si riferisce a 100 g; i prodotti inseriti o cercati possono usare 100 ml, con unità confermata dall'utente. Non esiste una conversione automatica fra grammi e millilitri. Gli alimenti fuori catalogo si aggiungono da etichetta.

Dalla scheda di una ricetta, **+ Diario** trasferisce una porzione delle dosi correnti. Se la scheda mostra più porzioni, prima divide il totale per quel numero; il modulo del diario permette poi di registrare quante ne sono state mangiate, anche frazioni. Ogni voce conserva una copia di nutrienti, fonte e ingredienti per porzione: gli aggiornamenti successivi del ricettario non modificano i giorni già registrati. Tocca una voce per cambiarne quantità, giorno o pasto, oppure rimuoverla. Dopo una rimozione puoi annullare l'ultima operazione.

In **Obiettivo e backup del diario** puoi impostare un obiettivo calorico facoltativo, esportare tutti i giorni o importarli su un altro dispositivo. Il file contiene dati personali e va conservato privatamente. L'importazione aggiunge gli ID mancanti; non sovrascrive le voci esistenti e non ripristina versioni precedenti di una voce modificata. Conserva l'obiettivo locale se già presente. Un file non valido viene rifiutato prima di qualsiasi scrittura.

Il diario usa `localStorage` con chiave `cibo-sano:diary:v1`. Lo schema contiene `entries`, `foods` personali e `goal` facoltativo. Le scritture sono serializzate con Web Locks nei browser che lo supportano (incluso Chrome Android); in altri browser il ciclo lettura/scrittura non garantisce l'assenza di conflitti fra finestre contemporanee. Errori di quota o accesso non chiudono il modulo né mostrano un salvataggio riuscito. Un archivio corrotto resta conservato ed è esportabile come copia di recupero. Non viene caricato automaticamente nel repository, non è incluso nel link pubblico e non è sincronizzato. Cancellare i dati del browser può eliminarlo.

## Codici a barre

Lo scanner legge EAN-13, EAN-8 e UPC-A. Chiede la fotocamera solo dopo **Apri fotocamera**, preferisce la posteriore e arresta lo stream alla lettura, alla chiusura o quando l'app passa in background. Foto e video restano sul dispositivo. Rimane sempre disponibile l'inserimento manuale. Su Android serve un browser compatibile e l'indirizzo HTTPS pubblico.

Il client usa [Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) tramite `GET /api/v2/product/{barcode}.json`, con campi selezionati, `credentials: omit`, identificazione pubblica dell'app e timeout di 12 secondi. Questa versione è ancora supportata ma deprecata: un futuro passaggio a v3.6 deve includere il nuovo parser di `product.nutrition`; cambiare solo l'URL non funziona. L'adattatore attuale usa `product.nutriments`, verifica i campi mancanti e non li trasforma in zero. L'energia dichiarata in kJ è convertibile in kcal dividendo per 4,184; non si usa una ricostruzione 4/4/9.

Anche il suffisso `_100g` può indicare valori per 100 ml: la scelta dell'unità è obbligatoria prima del salvataggio. Il prodotto viene sempre mostrato per controllo, senza registrazione automatica. Una nuova ricerca richiede rete; i prodotti confermati rimangono disponibili nel diario locale e vengono inclusi nel backup. Le risposte già ottenute sono riusate nella sessione. Sono gestiti prodotto assente, dati incompleti, timeout, risposta illeggibile e limite di richieste. Il database collaborativo non garantisce che ogni prodotto esista o sia corretto.

Attribuzione: **Open Food Facts**, link alla scheda prodotto, [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). I dati esterni non vengono fusi nel `recipes.json` pubblico. Per redistribuire un database derivato occorre rispettare anche le condizioni share-alike. Non vengono usate immagini dei prodotti.

Il fallback vendorizzato è `@zxing/browser` 0.2.1, dal [tarball npm ufficiale](https://registry.npmjs.org/@zxing/browser/-/browser-0.2.1.tgz). È caricato dalla stessa origine, non da un CDN; il bundle include `@zxing/library`. Licenze e provenienza sono in [vendor/README.md](vendor/README.md).

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

Il primo comando aggiorna l'identificativo e la data del ricettario se cambia il contenuto. Aggiorna anche la versione della cache offline quando cambiano i file dell'app. Il secondo verifica dati, filtri, porzioni e riferimenti alle risorse offline.

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

Zero esclude un ingrediente. Campi vuoti, negativi, non numerici o superiori a 10.000 g sospendono il calcolo finché non sono corretti. I decimali accettano punto o virgola. Il pulsante di ripristino torna a una porzione con le dosi proposte. I pesi modificati durano fino alla chiusura della scheda; se premi **+ Diario** e confermi, la copia della porzione viene salvata solo nel diario del browser.

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
| [diary.mjs](diary.mjs), [diary-ui.js](diary-ui.js), [diary.css](diary.css) | Diario locale, backup, conti e interfaccia dei pasti |
| [foods.mjs](foods.mjs), [scanner.js](scanner.js), [vendor/](vendor/) | Ricerca prodotti e scanner |
| [recipes.json](recipes.json) | Ricette pubbliche, senza dati del profilo personale |
| [manifest.webmanifest](manifest.webmanifest), [icons/](icons/) | Installazione e icone Android |
| [sw.js](sw.js) | Copia offline dell'app e aggiornamento delle ricette |

Il service worker prova la rete per `recipes.json`; se non riesce usa la copia salvata e segnala che sta mostrando dati locali. I file dell'interfaccia sono salvati insieme nella cache di una versione. I link esterni non vengono scaricati o memorizzati dall'app.

L'app e la repository sono pubbliche. Il tag `noindex` chiede ai motori di ricerca di non indicizzare la pagina, ma non limita l'accesso e non garantisce riservatezza. Nei file del repository inserisci soltanto dati destinati alla pubblicazione: niente email, credenziali, diari esportati, profili nutrizionali personali o link alla raccolta privata. Le registrazioni effettuate nell’interfaccia del diario restano invece nel browser.

Le ricette restano attribuite agli autori delle fonti. Le porzioni e le calorie proposte sono stime, separate dalle quantità dell'autore; non costituiscono un piano alimentare individuale.
