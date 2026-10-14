# Librerie distribuite con l'app

## Scanner locale

`zxing-browser.min.js` è il bundle UMD non modificato di `@zxing/browser` **0.2.1**, prelevato dal [registro npm](https://registry.npmjs.org/@zxing/browser/-/browser-0.2.1.tgz) il 14 ottobre 2026. L’integrità SHA-512 del tarball è stata verificata rispetto ai metadati npm.

SHA-256 del bundle: `066bc34edfcdd4a33f0964aeec967752a0dea1ccaf36e58e319ac9fcb5070f6a`.

Il wrapper usa la licenza [MIT](zxing-browser-LICENSE). Il motore `@zxing/library` incluso nel bundle usa [Apache-2.0](zxing-library-LICENSE). Conservare entrambi i file quando si distribuisce il bundle. Il sorgente è disponibile nei repository [zxing-js/browser](https://github.com/zxing-js/browser) e [zxing-js/library](https://github.com/zxing-js/library).

L’app carica il bundle soltanto se il browser non espone un lettore nativo EAN-13 utilizzabile. La copia offline include il file. Non sono necessarie richieste a un CDN durante la scansione.

## Esportazione PDF locale

`jspdf.umd.min.js` è il bundle UMD non modificato di **jsPDF 4.2.1**, prelevato dal [registro npm](https://registry.npmjs.org/jspdf/-/jspdf-4.2.1.tgz) il 14 ottobre 2026. L'integrità SHA-512 del tarball è stata verificata rispetto ai metadati npm.

SHA-256 del bundle: `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54`.

Licenza [MIT](jspdf-LICENSE); [sorgente e documentazione ufficiale](https://github.com/parallax/jsPDF). Il file viene caricato alla prima esportazione e incluso nella copia offline. I report usano testo e tabelle vettoriali; non caricano HTML, immagini esterne, font o servizi remoti.

## Lettura locale delle etichette

Il lettore OCR usa copie non modificate di **tesseract.js 6.0.1** e **tesseract.js-core 6.0.0**, prelevate il 14 ottobre 2026 dai tarball npm ufficiali:

- [tesseract.js 6.0.1](https://registry.npmjs.org/tesseract.js/-/tesseract.js-6.0.1.tgz), file `dist/tesseract.min.js`, `dist/worker.min.js` e relative licenze.
- [tesseract.js-core 6.0.0](https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-6.0.0.tgz), quattro file `tesseract-core*.wasm.js` e licenza.

L'integrità SHA-512 dei due tarball è stata verificata rispetto ai metadati npm delle versioni indicate. I file distribuiti sono stati confrontati byte per byte con quelli nei tarball, incluse le licenze. I sorgenti sono nei repository ufficiali [naptha/tesseract.js](https://github.com/naptha/tesseract.js) e [naptha/tesseract.js-core](https://github.com/naptha/tesseract.js-core).

Il modello italiano [ita.traineddata](tesseract/ita.traineddata), 2.701.314 byte, proviene da [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast/blob/87416418657359cb625c412a48b6e1d6d41c29bd/ita.traineddata), commit `87416418657359cb625c412a48b6e1d6d41c29bd`. Anche modello e licenza sono stati confrontati byte per byte con quel commit.

### File e impronte SHA-256

I percorsi nella tabella sono relativi a questa cartella.

| File | Byte | SHA-256 |
| --- | ---: | --- |
| [tesseract/tesseract.min.js](tesseract/tesseract.min.js) | 62.961 | `10fff78484067759c43028a02a72d76d0b90eb17302bb23b58a9ec5410bc928b` |
| [tesseract/worker.min.js](tesseract/worker.min.js) | 111.162 | `38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842` |
| [tesseract/ita.traineddata](tesseract/ita.traineddata) | 2.701.314 | `b8f89e1e785118dac4d51ae042c029a64edb5c3ee42ef73027a6d412748d8827` |
| [tesseract/core/tesseract-core.wasm.js](tesseract/core/tesseract-core.wasm.js) | 4.750.805 | `e66872f6a76f5ad414d73d21512245df0de3060ad4871a97c47efceaab27b955` |
| [tesseract/core/tesseract-core-simd.wasm.js](tesseract/core/tesseract-core-simd.wasm.js) | 4.751.193 | `3b0678c47a8dea6abb931b214171c08b742a5b9a9fcbbb1a028a08d5de6e9d4c` |
| [tesseract/core/tesseract-core-lstm.wasm.js](tesseract/core/tesseract-core-lstm.wasm.js) | 3.954.181 | `775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687` |
| [tesseract/core/tesseract-core-simd-lstm.wasm.js](tesseract/core/tesseract-core-simd-lstm.wasm.js) | 3.954.569 | `9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7` |

Le quattro varianti del core incorporano il WebAssembly nel file JavaScript. Comprendono le varianti LSTM e legacy, con e senza SIMD, per un totale di circa 17,4 MB. Il browser seleziona una sola variante adatta alle sue capacità; l'app usa il riconoscimento LSTM con lingua italiana. Il primo uso scarica normalmente circa 6,8 MB di file, includendo runtime, worker, un core LSTM e modello italiano. Le dimensioni indicate precedono l'eventuale compressione HTTP.

### Caricamento, cache e licenze

[label-ocr.mjs](../label-ocr.mjs) configura tutti i percorsi sotto `vendor/tesseract/`, sulla stessa origine dell'app. Runtime e worker vengono caricati al primo utilizzo, senza CDN; la foto viene elaborata sul dispositivo. Il [service worker](../sw.js) salva in cache solo i file OCR richiesti. I file non sono nella precache iniziale: per il primo uso serve rete e un aggiornamento dell'app può richiederne un nuovo download. La foto e il testo riconosciuto non vengono salvati nei file del sito o nel backup personale.

Tesseract.js, il core e tessdata_fast usano Apache-2.0. Conservare [tesseract.js-LICENSE](tesseract/tesseract.js-LICENSE), [tesseract.js-core-LICENSE](tesseract/tesseract.js-core-LICENSE) e [tessdata_fast-LICENSE](tesseract/tessdata_fast-LICENSE). Conservare anche [tesseract.min.js.LICENSE.txt](tesseract/tesseract.min.js.LICENSE.txt) e [worker.min.js.LICENSE.txt](tesseract/worker.min.js.LICENSE.txt), con le attribuzioni delle dipendenze incluse nei bundle.
