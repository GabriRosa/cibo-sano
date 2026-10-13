# Cibo sano

Ricettario in italiano installabile su Android e consultabile offline. Contiene ricette tratte da fonti Instagram, recuperi dai video e proposte con ingredienti pesati per una persona.

L'app usa HTML, CSS e JavaScript, senza dipendenze, server applicativo, account o strumenti di analisi. GitHub Pages distribuisce i file della cartella principale. Non serve acquistare un dominio. La gratuità dipende dalle condizioni e dai limiti del piano GitHub utilizzato.

## Sul telefono

Apri l'indirizzo dell'app in Chrome, poi usa **Menu ⋮ → Aggiungi a schermata Home → Installa**. La voce può variare con la versione del browser.

Al primo accesso online attendi l'indicazione “Pronto anche offline”. In seguito puoi leggere le ricette senza rete. I link alle fonti e i video Instagram richiedono una connessione.

I preferiti si salvano nel browser del dispositivo. Dalla schermata Informazioni puoi esportarli o importarli; cancellare i dati del browser li elimina. Il backup esportato contiene soltanto gli identificativi delle ricette.

## Aggiornare le ricette

La fonte dei dati dell'app è [recipes.json](recipes.json). Ogni voce ha un identificativo stabile: mantienilo quando correggi una ricetta, così preferiti e link continuano a funzionare. Per una nuova scheda copia una voce dello stesso tipo e assegna un nuovo `id`.

- `kind: "originale"`: ingredienti nel campo `ingredientText`, passaggi in `steps`, quantità come riportate dalla fonte. Queste dosi non vengono moltiplicate automaticamente.
- `kind: "porzione"`: ingredienti strutturati con `name`, `grams`, `added` e `note`; base di una persona. `added: true` indica un ingrediente proposto per completare il pasto. `kcal` è una stima per persona.
- `notes`, `author`, `url` e `sourceType` mantengono note e attribuzioni. `extraSource` è un link facoltativo. Le categorie ammesse sono definite in [lib.mjs](lib.mjs).

Con Node.js recente, dalla cartella del progetto:

```sh
node scripts/version.mjs
node --test tests/*.test.mjs
```

Il primo comando aggiorna l'identificativo e la data del ricettario se cambia il contenuto. Aggiorna anche la versione della cache offline quando cambiano i file dell'app. Il secondo verifica dati, filtri, porzioni e riferimenti alle risorse offline.

Salva le modifiche su Git e inviale al ramo `main`. Con GitHub Pages configurato su **Deploy from a branch → main → / (root)**, ogni aggiornamento del ramo avvia una nuova pubblicazione. La disponibilità effettiva dipende dal completamento della pubblicazione GitHub.

L'app cerca nuove ricette all'apertura online e con il pulsante di aggiornamento. L'aggiornamento dei dati non richiede reinstallazione. Il recupero di nuove ricette da Instagram è un'attività separata: questa app non accede all'account Instagram e non controlla i salvataggi.

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
