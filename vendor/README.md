# Scanner locale

`zxing-browser.min.js` è il bundle UMD non modificato di `@zxing/browser` **0.2.1**, prelevato dal [registro npm](https://registry.npmjs.org/@zxing/browser/-/browser-0.2.1.tgz) il 14 ottobre 2026. L’integrità SHA-512 del tarball è stata verificata rispetto ai metadati npm.

SHA-256 del bundle: `066bc34edfcdd4a33f0964aeec967752a0dea1ccaf36e58e319ac9fcb5070f6a`.

Il wrapper usa la licenza [MIT](zxing-browser-LICENSE). Il motore `@zxing/library` incluso nel bundle usa [Apache-2.0](zxing-library-LICENSE). Conservare entrambi i file quando si distribuisce il bundle. Il sorgente è disponibile nei repository [zxing-js/browser](https://github.com/zxing-js/browser) e [zxing-js/library](https://github.com/zxing-js/library).

L’app carica il bundle soltanto se il browser non espone un lettore nativo EAN-13 utilizzabile. La copia offline include il file. Non sono necessarie richieste a un CDN durante la scansione.

## Esportazione PDF locale

`jspdf.umd.min.js` è il bundle UMD non modificato di **jsPDF 4.2.1**, prelevato dal [registro npm](https://registry.npmjs.org/jspdf/-/jspdf-4.2.1.tgz) il 14 ottobre 2026. L'integrità SHA-512 del tarball è stata verificata rispetto ai metadati npm.

SHA-256 del bundle: `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54`.

Licenza [MIT](jspdf-LICENSE); [sorgente e documentazione ufficiale](https://github.com/parallax/jsPDF). Il file viene caricato alla prima esportazione e incluso nella copia offline. I report usano testo e tabelle vettoriali; non caricano HTML, immagini esterne, font o servizi remoti.
