# Scanner locale

`zxing-browser.min.js` è il bundle UMD non modificato di `@zxing/browser` **0.2.1**, prelevato dal [registro npm](https://registry.npmjs.org/@zxing/browser/-/browser-0.2.1.tgz) il 14 ottobre 2026. L’integrità SHA-512 del tarball è stata verificata rispetto ai metadati npm.

SHA-256 del bundle: `066bc34edfcdd4a33f0964aeec967752a0dea1ccaf36e58e319ac9fcb5070f6a`.

Il wrapper usa la licenza [MIT](zxing-browser-LICENSE). Il motore `@zxing/library` incluso nel bundle usa [Apache-2.0](zxing-library-LICENSE). Conservare entrambi i file quando si distribuisce il bundle. Il sorgente è disponibile nei repository [zxing-js/browser](https://github.com/zxing-js/browser) e [zxing-js/library](https://github.com/zxing-js/library).

L’app carica il bundle soltanto se il browser non espone un lettore nativo EAN-13 utilizzabile. La copia offline include il file. Non sono necessarie richieste a un CDN durante la scansione.
