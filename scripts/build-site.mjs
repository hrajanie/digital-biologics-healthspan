import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
// Publish a portable, prebuilt copy for GitHub Pages.
await rm('docs', {recursive: true, force: true});
await mkdir('docs', {recursive: true});
await cp('dist', 'docs', {recursive: true});
await writeFile('docs/.nojekyll', '');
console.log('GitHub Pages site updated in docs/');
