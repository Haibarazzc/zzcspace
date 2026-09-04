import assert from 'node:assert/strict';
import { renderMarkdown } from './markdown.ts';

const html = await renderMarkdown([
  '# Heading',
  '~~removed~~',
  '| A | B |\n| - | - |\n| 1 | 2 |',
  '$x^2$',
  '```javascript\nconst x = 1;\n```',
  '```unknown-language\n<keep>\n```',
  '<br/>',
].join('\n\n'));

for (const fragment of ['<h1>Heading</h1>', '<del>removed</del>', '<table>', 'class="katex"', 'hljs-keyword', '&#x3C;keep>', '<br/>']) {
  assert.ok(html.includes(fragment), `Missing rendered Markdown feature: ${fragment}`);
}
console.log('Markdown regression check passed');
