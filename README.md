# Cibo sano

Ricettario in italiano installabile su Android e consultabile offline. Contiene ricette tratte da fonti Instagram, recuperi dai video e proposte con ingredienti pesati per una persona.

L'app usa HTML, CSS e JavaScript, senza dipendenze, server applicativo, account o strumenti di analisi. GitHub Pages distribuisce i file della cartella principale. Non serve acquistare un dominio. La gratuità dipende dalle condizioni e dai limiti del piano GitHub utilizzato.

## Sul telefono

Apri l'indirizzo dell'app in Chrome, poi usa **Menu ⋮ → Aggiungi a schermata Home → Installa**. La voce può variare con la versione del browser.

Al primo accesso online attendi l'indicazione “Pronto anche offline”. In seguito puoi leggere le ricette senza rete. I link alle fonti e i video Instagram richiedono una connessione.

I preferiti si salvano nel browser del dispositivo. Dalla schermata Informazioni puoi esportarli o importarli; cancellare i dati del browser li elimina. Il backup esportato contiene soltanto gli identificativi delle ricette.

## Aggiornare le ricette

La fonte dei dati dell'app è [recipes.json](recipes.json). Ogni voce ha un identificativo stabile: mantienilo quando correggi una ricetta, così preferiti e link continuano a funzionare. Per una nuova scheda copia una voce dello stesso tipo e assegna un nuovo `id`.

- `kind: "originale"`: ingredienti nel campo `ingredientText`, passaggi in `steps`, testo originale conservato. Anche queste schede hanno ingredienti strutturati per una porzione e un campo `quantityNote` che descrive dosi stimate, resa e scelte fra alternative. `portionLabel` specifica se la porzione è un piatto, una barretta, una dose di salsa o altro; `batchServings` indica in quante porzioni è stata divisa la preparazione. `sourceRecipeId` collega le varianti alla scheda originale.
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

## Quantità e valori nutrizionali

Tutte le 135 schede (45 idee e 90 ricette o varianti dalle fonti) mostrano kcal e macro per la dose di base anche nell'elenco. Nel dettaglio, ogni campo in grammi modifica il totale con la formula `valore per 100 g × grammi / 100`. Il numero di porzioni scala proporzionalmente le quantità correnti, comprese le modifiche manuali. Da due porzioni in su è visibile anche il totale diviso per il numero di porzioni.

Zero esclude un ingrediente. Campi vuoti, negativi, non numerici o superiori a 10.000 g sospendono il calcolo finché non sono corretti. I decimali accettano punto o virgola. Il pulsante di ripristino torna a una porzione con le dosi proposte. I pesi modificati durano fino alla chiusura della scheda e non vengono pubblicati o salvati nel browser.

I dati provengono da [CoFID 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), Crown copyright, con licenza [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), e dalle etichette dei prodotti indicate in ogni voce. Le tracce CoFID sono conteggiate come zero. Alcuni nomi generici usano un alimento rappresentativo dichiarato nella nota. Lo stato crudo/cotto/sgocciolato deve corrispondere al peso utilizzato. Le energie delle fonti possono differire dal solo calcolo 4/4/9 per fibre, acidi organici e fattori di conversione. Le etichette di marca sono riferimenti, non l'identificazione del prodotto usato dall'utente.

Le 80 schede originali sono ora 90 perché schiscette, crêpes, pranzi e gelati con varianti distinte hanno schede separate. Gli identificativi precedenti restano validi. I pesi mancanti, le conversioni da cucchiai/pezzi e gli alimenti non identificati sono stime dichiarate, non dati ricavati dalla fonte. Le farciture o guarnizioni facoltative escluse sono specificate nella scheda. Il procedimento originale non viene riscritto né ridimensionato automaticamente: può descrivere più porzioni o alternative.

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
| [recipes.json](recipes.json) | Ricette pubbliche, senza dati del profilo personale |
| [manifest.webmanifest](manifest.webmanifest), [icons/](icons/) | Installazione e icone Android |
| [sw.js](sw.js) | Copia offline dell'app e aggiornamento delle ricette |

Il service worker prova la rete per `recipes.json`; se non riesce usa la copia salvata e segnala che sta mostrando dati locali. I file dell'interfaccia sono salvati insieme nella cache di una versione. I link esterni non vengono scaricati o memorizzati dall'app.

L'app e la repository sono pubbliche. Il tag `noindex` chiede ai motori di ricerca di non indicizzare la pagina, ma non limita l'accesso e non garantisce riservatezza. Inserisci soltanto dati destinati alla pubblicazione. Non inserire email, credenziali, profili nutrizionali personali o link alla raccolta privata.

Le ricette restano attribuite agli autori delle fonti. Le porzioni e le calorie proposte sono stime, separate dalle quantità dell'autore; non costituiscono un piano alimentare individuale.
