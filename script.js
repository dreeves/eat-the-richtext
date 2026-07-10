// import { DEBOUNCE_INTERVAL, VERSION } from './constants.js';

// jQuery-esque utility function for concise code.
// This is the ONE line of code dreev wrote and actually it's just
// something he picked up from the internet somewhere so we think
// this still counts as wholly written by ChatGPT.
const $ = (id) => document.getElementById(id);

// Singular or plural. Eg, splur(0, "cat") returns "0 cats" or for irregular
// plurals, eg, splur(1, "child", "children") returns "1 child".
function splur(n, s, p=null) { return n === 1    ? `${n} ${s}`
                                    : p === null ? `${n} ${s}s`
                                    :              `${n} ${p}`
}

// Replace every Unicode space-separator character (non-breaking spaces and
// friends) with a plain ascii space, one-for-one, so string lengths and
// cursor positions are preserved. Invariant: the markdown pane never
// contains non-ascii spaces; an intentional non-breaking space is written
// in the markdown as an explicit "&nbsp;".
const asciiSpaces = (text) => text.replace(/\p{Zs}/gu, ' ');


const initializeApp = (debounceInterval, version) => {

const markdownTextarea = $('markdown');

if (window.quillBetterTable) {
  Quill.register({'modules/better-table': window.quillBetterTable}, true);
  //console.log('Quill Better Table module registered');
} //else {
  //console.warn('Quill Better Table not available');
//}

// Quill has no built-in horizontal-rule support, so register an embed blot
// for <hr>. With this registered, Quill's clipboard converts <hr> elements
// on paste and getSemanticHTML emits them back out, so both conversion
// directions just work.
const BlockEmbed = Quill.import('blots/block/embed');
class DividerBlot extends BlockEmbed {}
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
Quill.register(DividerBlot);

// "tight" marks a line that ends in a hard break (<br>) rather than a
// paragraph break. Quill flattens both into plain line splits on ingest,
// so without this marker the distinction is unrecoverable; with it, strict
// mode's stylesheet can keep hard-broken lines snug against the next line
// while blank-line paragraphs get vertical margin (see .strict-newlines
// rules; ClassAttributor suffixes the value, so the DOM class is
// "ql-tight-true"). The marker is internal to the editor: everything that
// leaves it goes through mergeTightLines below, so markdown serialization
// and copied richtext carry real in-paragraph <br> structure.
const { ClassAttributor, Scope } = Quill.import('parchment');
Quill.register('formats/tight',
               new ClassAttributor('tight', 'ql-tight',
                                   { scope: Scope.BLOCK }));

// "softwrap" marks an ordinary space that stands for a soft line wrap in
// the markdown source (a single newline that strict mode renders as a
// space). Riding in the document as a format on a real space, it
// survives editing at character granularity; serialization emits it back
// as a newline (see the softwrap turndown rule) and copying strips it to
// the plain space it looks like.
Quill.register('formats/softwrap',
               new ClassAttributor('softwrap', 'ql-softwrap',
                                   { scope: Scope.INLINE }));

// Rejoin tight-marked lines into a single paragraph with real <br>
// separators, so that what the editor displays is exactly the structure
// other apps receive. Processing in reverse document order lets chains
// (a<br>b<br>c) collapse with no bookkeeping: every line absorbs an
// already-merged successor. Empty tight lines are explicit blank lines
// (the "<br>" convention), not continuations, so they stay separate.
const TIGHT = 'ql-tight-true';
const mergeTightLines = (html) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  [...temp.querySelectorAll('p.' + TIGHT)].reverse().forEach((p) => {
    p.classList.remove(TIGHT);
    if (p.classList.length === 0) p.removeAttribute('class');
    const next = p.nextElementSibling;
    if (p.textContent && next?.nodeName === 'P' && next.textContent) {
      p.append(document.createElement('br'), ...next.childNodes);
      next.remove();
    }
  });
  return temp.innerHTML;
};

// Copied or cut richtext leaves the editor with its true structure and
// ordinary characters: tight lines rejoined into real <br> paragraphs,
// softwrap markers stripped to the plain spaces they look like, and
// Quill's space->&nbsp; conversion undone so paste targets get real
// spaces (the entire NBSP saga, but on the copy exit).
const exportHtml = (html) => {
  const temp = document.createElement('div');
  temp.innerHTML = mergeTightLines(html);
  temp.querySelectorAll('span.ql-softwrap-true').forEach((s) =>
    s.replaceWith(...s.childNodes));
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    walker.currentNode.textContent =
      asciiSpaces(walker.currentNode.textContent);
  }
  return temp.innerHTML;
};

const Clipboard = Quill.import('modules/clipboard');
class MergingClipboard extends Clipboard {
  onCopy(range, isCut) {
    const copied = super.onCopy(range, isCut);
    return { ...copied, html: exportHtml(copied.html) };
  }
}
Quill.register('modules/clipboard', MergingClipboard, true);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  hr: '---',
  // Turndown routes "blank" nodes past all rules to this handler, and
  // whitespace-only content counts as blank, so two meaningful things
  // land here. (1) Softwrap marker spans (their content is a lone space,
  // rendered &nbsp; by getSemanticHTML): serialize as the newline they
  // stand for. (2) Empty richtext lines, arriving as blank <p></p>:
  // serialize as explicit "<br>" lines, which marked renders back into
  // empty lines; without this they'd be silently eaten (a blank markdown
  // line is structure, not content). The nextSibling check exempts
  // document-final empties -- the trailing newline is structural, like a
  // file's -- and with it the empty document serializes to nothing.
  // Everything else gets turndown's default blank handling.
  blankReplacement: (content, node) =>
    node.nodeName === 'SPAN' && node.classList.contains('ql-softwrap-true')
      ? '\n'
      : node.nodeName === 'P' && node.nextSibling
        ? '\n\n<br>\n\n'
        : node.isBlock ? '\n\n' : ''
});

// Preserve superscript and subscript tags
turndownService.addRule('superscript', {
  filter: ['sup'],
  replacement: (content) => `<sup>${content}</sup>`
});

turndownService.addRule('subscript', {
  filter: ['sub'],
  replacement: (content) => `<sub>${content}</sub>`
});

// One space after list markers ("* item", "1. item") instead of turndown's
// default three ("*   item"). Same as turndown's built-in listItem rule
// except the prefix is shorter and continuation lines are indented by the
// prefix's actual length so nested lists still align under their parent.
// WARNING: this duplicates the internals of turndown's listItem rule
// (turndown has a bulletListMarker option but no spacing option, so an
// override is the only supported hook). If the pinned turndown version is
// ever bumped, upstream fixes to its listItem rule won't apply here --
// re-diff this against upstream's and rerun the list quals.
turndownService.addRule('listItem', {
  filter: 'li',
  replacement: (content, node, options) => {
    let prefix = options.bulletListMarker + ' ';
    const parent = node.parentNode;
    if (parent.nodeName === 'OL') {
      const start = parent.getAttribute('start');
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = (start ? Number(start) + index : index + 1) + '. ';
    }
    content = content
      .replace(/^\n+/, '')     // remove leading newlines
      .replace(/\n+$/, '\n')   // collapse trailing newlines to one
      .replace(/\n/gm, '\n' + ' '.repeat(prefix.length));
    return prefix + content +
           (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
  }
});

// Softwrap markers come back out of the editor as the newlines they stand
// for. getSemanticHTML renders the marked space as &nbsp; (hence
// asciiSpaces) and turndown's flanking-whitespace pass can pull a real
// space out of the span leaving empty content (hence the '' case). If
// editing ever smuggles extra text into a marker span, degrade to the
// literal content -- toward a plain space, never data loss.
turndownService.addRule('softwrap', {
  filter: (node) => node.nodeName === 'SPAN' &&
                    node.classList.contains('ql-softwrap-true'),
  replacement: (content) => {
    const c = asciiSpaces(content);
    return c === ' ' || c === '' ? '\n' : content;
  }
});

// Convert paragraphs that are just "---" or "***" to horizontal rules
turndownService.addRule('horizontalRuleFromParagraph', {
  filter: (node) => {
    return node.nodeName === 'P' &&
           (node.textContent.trim() === '---' ||
            node.textContent.trim() === '***' ||
            node.textContent.trim() === '___');
  },
  replacement: () => '\n---\n'
});

// Add table support via GFM plugin
if (window.turndownPluginGfm) {
  const gfm = window.turndownPluginGfm.gfm;
  turndownService.use(gfm);
  //console.log('Table support enabled via GFM plugin');
} else {
  //console.error('Turndown GFM plugin not loaded!');
}

const divider = $('divider');
const container = document.querySelector('.container');
let isDragging = false;

// Below this viewport width the panes stack vertically and the divider
// drags up/down instead of left/right. Must match the media query in
// style.css.
const stackedLayout = window.matchMedia('(max-width: 700px)');

// Reset any dragged pane sizes when the layout flips between side-by-side
// and stacked, since a column split makes no sense as a row split.
stackedLayout.addEventListener('change', () => {
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
});

// Debounce function to limit the rate at which a function can fire.
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Helper for toolbar handlers
const createHandler = (format) => () => {
  quill.format(format, !quill.getFormat()[format]);
};

// Initialize Quill editor with custom toolbar
const modules = {
  toolbar: {
    container: [
      [{ header: [1, 2, 3, 4, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      [{ 'clean': 'true' }]  // Add clear formatting button
    ],
    handlers: {
      bold:        createHandler('bold'),
      italic:      createHandler('italic'),
      underline:   createHandler('underline'),
      strike:      createHandler('strike'),
      blockquote:  createHandler('blockquote'),
      'code-block': createHandler('code-block'),
      link: () => {
        const value = prompt('Enter the URL');
        quill.format('link', value);
      },
      image: () => {
        const value = prompt('Enter the image URL');
        quill.format('image', value);
      },
      clean: () => {
        const range = quill.getSelection();
        if (range) {
          quill.removeFormat(range.index, range.length);
        }
      }
    },
  }
};

// Add table support if available
if (window.quillBetterTable) {
  modules.table = false;
  modules['better-table'] = {
    operationMenu: {
      items: {
        unmergeCells: { text: 'Unmerge cells' }
      }
    }
  };
  modules.keyboard = {
    bindings: window.quillBetterTable.keyboardBindings || {}
  };
}

const quill = new Quill('#richtext', {
  theme: 'snow',
  modules: modules
});

// Ingesting a <br> normally yields an anonymous line split; tag the line it
// terminates with the "tight" marker instead (see the attributor above).
quill.clipboard.addMatcher('BR', () => {
  const Delta = Quill.import('delta');
  return new Delta().insert('\n', { tight: true });
});

// Add tooltips to Quill toolbar buttons
const tooltipMap = {
  'ql-bold': 'Bold',
  'ql-italic': 'Italics',
  'ql-underline': 'Underline',
  'ql-strike': 'Strikethrough',
  'ql-header': 'Header',
  'ql-list': { ordered: 'Numbered list', bullet: 'Bulleted list' },
  'ql-blockquote': 'Block quote',
  'ql-code-block': 'Code block',
  'ql-link': 'Link',
  'ql-image': 'Image',
  'ql-clean': 'Clear formatting'  // Tooltip for clear formatting button
};

document.querySelectorAll('.ql-toolbar button').forEach((button) => {
  const className = Array.from(button.classList).find((cls) =>
    cls.startsWith('ql-')
  );
  if (className && tooltipMap[className]) {
    let tooltip = tooltipMap[className];
    if (typeof tooltip === 'object') {
      const listType = button.getAttribute('value');
      tooltip = tooltip[listType];
    }
    tippy(button, { content: tooltip });
  }
});

// Initialize Tippy.js for copy and help buttons
tippy('.copy-btn', { content: 'Copy to clipboard' });
tippy('.help-icon', { content: 'What is happening here?' });
// TODO: recommended English tooltip: "When on, every newline in the
// markdown becomes a line break. When off, strict markdown rules apply:
// a blank line starts a new paragraph and a hard break needs a trailing
// double-space."
tippy('.newline-toggle', {
  content: 'Markdown newline ⇒ richtext newline. Uncheck for strict markdown, where you get a newline via trailing double space.'
});

let isUpdating = false;

// Update word count (not currently counting emoji as words; see Tallyglot)
function updateWordCount() {
  const text = markdownTextarea.value.trim();
  // Split by whitespace and filter out punctuation-only tokens
  const words = text.split(/\s+/).filter(token => /[a-zA-Z0-9]/.test(token));
  const wordCount = words.length;
  $('wordCount').textContent = splur(wordCount, "word");
};

// Load content from local storage
window.onload = () => {
  const savedHtml = localStorage.getItem('quillContent');
  const savedMarkdown = localStorage.getItem('markdownContent');
  if (savedHtml) quill.clipboard.dangerouslyPasteHTML(savedHtml);
  if (savedMarkdown) markdownTextarea.value = asciiSpaces(savedMarkdown);
  document.getElementById('version').innerText = version;
  updateWordCount();
};

// Save content to local storage
const saveContent = () => {
  try {
    const html = quill.getSemanticHTML();
    const markdown = markdownTextarea.value;
    localStorage.setItem('quillContent', html);
    localStorage.setItem('markdownContent', markdown);
  } catch (error) {
    console.error('Error saving content:', error);
  }
};

// Clean Quill Better Table artifacts from HTML
const cleanTableHtml = (html) => {
  if (!html) return html;
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove wrapper divs
  temp.querySelectorAll('.quill-better-table-wrapper').forEach(wrapper => {
    wrapper.replaceWith(...wrapper.childNodes);
  });
  
  // Strip all data-* attributes from table elements
  temp.querySelectorAll('table, tbody, thead, tr, td, th').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name === 'contenteditable') {
        el.removeAttribute(attr.name);
      }
    });
    // Also remove quill-better-table classes
    if (el.classList.contains('quill-better-table')) {
      el.classList.remove('quill-better-table');
      if (el.classList.length === 0) {
        el.removeAttribute('class');
      }
    }
  });
  
  // Unwrap p.qlbt-cell-line paragraphs, preserving their content
  temp.querySelectorAll('p.qlbt-cell-line').forEach(p => {
    p.replaceWith(...p.childNodes);
  });
  
  // Remove colgroup elements (they're just width hints)
  temp.querySelectorAll('colgroup').forEach(cg => cg.remove());
  
  // Convert first row to thead with th elements for proper GFM conversion
  temp.querySelectorAll('table').forEach(table => {
    const tbody = table.querySelector('tbody');
    if (tbody && !table.querySelector('thead')) {
      const firstRow = tbody.querySelector('tr');
      if (firstRow) {
        const thead = document.createElement('thead');
        
        // Convert td to th
        firstRow.querySelectorAll('td').forEach(td => {
          const th = document.createElement('th');
          th.innerHTML = td.innerHTML;
          if (td.hasAttribute('rowspan')) th.setAttribute('rowspan', td.getAttribute('rowspan'));
          if (td.hasAttribute('colspan')) th.setAttribute('colspan', td.getAttribute('colspan'));
          td.replaceWith(th);
        });
        
        thead.appendChild(firstRow);
        table.insertBefore(thead, tbody);
      }
    }
  });
  
  return temp.innerHTML;
};

// Quill's semantic HTML writes code blocks as <pre> holding bare text
// (framed by separator newlines), but turndown's fenced-code rule only
// fires on <pre><code>. Canonicalize the shape, trimming the framing
// newlines so they don't become blank fence lines.
const wrapPreCode = (html) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('code')) return;
    const code = document.createElement('code');
    code.textContent = pre.textContent.replace(/^\n/, '').replace(/\n$/, '');
    pre.replaceChildren(code);
  });
  return temp.innerHTML;
};

// Hollow out softwrap marker spans (their space arrives as &nbsp; from
// getSemanticHTML, or as a real space via canon); turndown would re-emit
// that whitespace as stray flanking around the newline. A span with
// anything more than the one space means editing leaked text into it --
// leave it intact so the degradation path keeps every character.
const hollowSoftwraps = (html) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('span.ql-softwrap-true').forEach((s) => {
    if (asciiSpaces(s.textContent) === ' ') s.textContent = '';
  });
  return temp.innerHTML;
};

// Convert HTML to Markdown. The asciiSpaces call is load-bearing: Quill's
// getSemanticHTML converts every ordinary space to "&nbsp;"
// (https://github.com/slab/quill/issues/4509), which turndown would
// otherwise pass through as literal U+00A0 characters.
const htmlToMarkdown = (html) => {
  const cleanedHtml =
    cleanTableHtml(wrapPreCode(mergeTightLines(hollowSoftwraps(html))));

  return asciiSpaces(turndownService.turndown(cleanedHtml));
};

// Convert Markdown to HTML with GFM tables enabled. (The breaks option is
// owned by the newline-mode toggle; see applyNewlineMode.)
marked.setOptions({
  gfm: true
});
const markdownToHtml = (markdown) => {
  const temp = document.createElement('div');
  temp.innerHTML = marked.parse(markdown);

  // Soft wraps -- newlines inside paragraph or list-item text, which
  // strict mode renders as spaces -- become softwrap-marked spaces so
  // they survive the trip through the editor (see the softwrap
  // attributor). A block-edge newline with no inline sibling beside it
  // is html formatting, not a wrap, and is dropped.
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT);
  const wrappable = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.textContent.includes('\n') &&
        n.parentElement.closest('p, li') !== null &&
        n.parentElement.closest('pre') === null) {
      wrappable.push(n);
    }
  }
  wrappable.forEach((n) => {
    const parts = n.textContent.split('\n');
    if (parts[0] === '' && n.previousSibling === null) parts.shift();
    if (parts[parts.length - 1] === '' && n.nextSibling === null) parts.pop();
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i > 0) {
        const wrap = document.createElement('span');
        wrap.className = 'ql-softwrap-true';
        wrap.textContent = ' ';
        frag.appendChild(wrap);
      }
      frag.appendChild(document.createTextNode(part));
    });
    n.replaceWith(frag);
  });

  // Transform tables for Quill Better Table compatibility
  temp.querySelectorAll('table').forEach(table => {
      // Convert thead to tbody (Better Table doesn't use thead)
      const thead = table.querySelector('thead');
      if (thead) {
        const tbody = table.querySelector('tbody') || document.createElement('tbody');
        // Convert th to td in header row
        thead.querySelectorAll('th').forEach(th => {
          const td = document.createElement('td');
          td.innerHTML = th.innerHTML;
          th.replaceWith(td);
        });
        // Move thead rows to start of tbody
        while (thead.firstChild) {
          tbody.insertBefore(thead.firstChild, tbody.firstChild);
        }
        thead.remove();
        if (!table.contains(tbody)) {
          table.appendChild(tbody);
        }
      }

      // Add colgroup if missing
      if (!table.querySelector('colgroup')) {
        const firstRow = table.querySelector('tr');
        if (firstRow) {
          const cellCount = firstRow.querySelectorAll('td, th').length;
          const colgroup = document.createElement('colgroup');

          for (let i = 0; i < cellCount; i++) {
            const col = document.createElement('col');
            col.setAttribute('width', '100');
            colgroup.appendChild(col);
          }

          table.insertBefore(colgroup, table.firstChild);
        }
      }

      // Strip whitespace-only text nodes from the table's structure (cell
      // contents are untouched): the table module folds inter-element
      // whitespace into the first cell's text on ingest, and marked puts
      // newlines between all these tags.
      [table, ...table.querySelectorAll('thead, tbody, tr, colgroup')]
        .forEach((el) => {
          [...el.childNodes].forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE && n.textContent.trim() === '') {
              n.remove();
            }
          });
        });
    });

  return temp.innerHTML;
};

// Reconcile regenerated markdown with what's already in the pane: blocks
// whose meaning didn't change keep the user's exact source text (soft
// wraps, emphasis-marker style, blank-line runs, fence style), and only
// genuinely changed blocks take the regenerated canonical text. The pane
// itself is the only state. Blocks are compared by canonical form --
// equal canonical strings render identically by construction -- so the
// two panes can never diverge semantically.
//
// canon() results are memoized because this runs on every richtext
// keystroke; the cache is cleared on newline-mode changes since the
// canonical form is mode-dependent (see applyNewlineMode).
const canonCache = new Map();
const canon = (block) => {
  if (!canonCache.has(block)) {
    canonCache.set(block, htmlToMarkdown(markdownToHtml(block)));
  }
  return canonCache.get(block);
};

// Split markdown into block-level chunks whose raw strings exactly tile
// the source (so code fences and lists can't be mis-split the way a
// blank-line regex would). Anything else is a bug we want to hear about
// immediately.
const blockRaws = (text) => {
  const raws = marked.lexer(text).map((t) => t.raw);
  if (raws.join('') !== text) {
    throw new Error('marked.lexer tokens do not tile the source');
  }
  return raws;
};

// Whitespace-only chunks (blank-line runs between blocks) all match each
// other, so the pane's spacing wins wherever the surrounding blocks match.
const blockKey = (raw) => raw.trim() === '' ? '<gap>' : canon(raw);

const reconcile = (paneText, canonText) => {
  if (paneText === canonText) return paneText;
  const pane = blockRaws(paneText);
  const gen = blockRaws(canonText);
  let pre = 0;
  while (pre < pane.length && pre < gen.length &&
         blockKey(pane[pre]) === blockKey(gen[pre])) pre++;
  let post = 0;
  while (post < pane.length - pre && post < gen.length - pre &&
         blockKey(pane[pane.length - 1 - post]) ===
         blockKey(gen[gen.length - 1 - post])) post++;
  return pane.slice(0, pre).join('') +
         gen.slice(pre, gen.length - post).join('') +
         pane.slice(pane.length - post).join('');
};

// Sync changes from Quill editor to Markdown textarea. The finally is
// lock hygiene: if conversion ever throws (e.g. the tiling assert in
// blockRaws), the error must stay loud on every keystroke instead of
// wedging isUpdating and silently killing both sync directions.
quill.on('text-change', () => {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const html = quill.getSemanticHTML();
    //if (html.includes('table')) { console.log('HTML from Quill:', html) }

    const markdown = htmlToMarkdown(html);
    //if (html.includes('table')) { console.log('Markdown output:', markdown) }

    markdownTextarea.value = reconcile(markdownTextarea.value, markdown);
    updateWordCount();
    saveContent();
  } finally {
    isUpdating = false;
  }
});

// Sync changes from Markdown textarea to Quill editor
const syncMarkdownToQuill = () => {
  if (isUpdating) return;
  isUpdating = true;
  const start = $('markdown').selectionStart;
  const end = $('markdown').selectionEnd;

  // Enforce the no-non-ascii-spaces invariant on whatever was typed or
  // pasted in; asciiSpaces is length-preserving so start/end stay valid.
  const markdown = asciiSpaces($('markdown').value);
  $('markdown').value = markdown;
  const html = markdownToHtml(markdown);

  try {
    quill.clipboard.dangerouslyPasteHTML(html);
  } catch (error) {
    console.error('Error pasting markdown to Quill:', error);
  }

  $('markdown').focus();
  $('markdown').setSelectionRange(start, end);

  updateWordCount();
  saveContent();
  isUpdating = false;
};

$('markdown').addEventListener(
  'input', debounce(syncMarkdownToQuill, debounceInterval));

// Newline-mode toggle. Checked ("preserve", the default): every newline in
// the markdown is a line break, the Discord / GitHub-comments dialect.
// Unchecked ("strict"): CommonMark semantics -- a blank line starts a new
// paragraph, a single newline soft-wraps, and a hard break needs a
// trailing double-space.
const preserveNewlines = $('preserveNewlines');

const applyNewlineMode = () => {
  canonCache.clear(); // canonical forms are newline-mode-dependent
  marked.setOptions({ breaks: preserveNewlines.checked });
  // Serialize hard breaks (<br>) the way the current dialect writes them:
  // a bare newline in preserve mode, trailing double-space in strict mode.
  // (Turndown appends "\n" to this.)
  turndownService.options.br = preserveNewlines.checked ? '' : '  ';
  // In strict mode each <p> is a true paragraph, so the stylesheet gives
  // them vertical margins (see .strict-newlines rules).
  document.body.classList.toggle('strict-newlines',
                                 !preserveNewlines.checked);
};

preserveNewlines.addEventListener('change', () => {
  localStorage.setItem('preserveNewlines', preserveNewlines.checked);
  applyNewlineMode();
  syncMarkdownToQuill();
});

// Default is preserve; only an explicitly stored "false" means strict.
preserveNewlines.checked =
  localStorage.getItem('preserveNewlines') !== 'false';
applyNewlineMode();

// Show help modal
const showHelp = () => {
  fetch('help.md')
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.text();
    })
    .then((text) => {
      $('helpContent').innerHTML = marked.parse(text);
      $('helpModal').style.display = 'block';
    })
    .catch((error) => console.error('Error fetching help content:', error));
};

// Close help modal
const closeHelp = () => {
  $('helpModal').style.display = 'none';
};

// Close the modal if the user clicks outside of it
window.onclick = (event) => {
  const modal = $('helpModal');
  if (event.target == modal) modal.style.display = 'none';
};

// Close the modal if the user presses Escape
window.onkeydown = (event) => {
  if (event.key === 'Escape') {
    const modal = $('helpModal');
    if (modal.style.display === 'block') {
      closeHelp();
    }
  }
};

// Handle drag for both mouse and touch events
const handleDragStart = (e) => {
  isDragging = true;
  document.body.style.cursor = stackedLayout.matches ? 'row-resize'
                                                     : 'col-resize';

  document.addEventListener('mousemove', onDragging);
  document.addEventListener('mouseup', stopDragging);
  document.addEventListener('mouseleave', stopDragging);

  document.addEventListener('touchmove', onDragging);
  document.addEventListener('touchend', stopDragging);
  document.addEventListener('touchcancel', stopDragging);
};

const onDragging = (e) => {
  if (!isDragging) return;
  const containerRect = container.getBoundingClientRect();
  const point = e.touches ? e.touches[0] : e;
  if (stackedLayout.matches) {
    const percentage =
      ((point.clientY - containerRect.top) / containerRect.height) * 100;
    container.style.gridTemplateRows =
      `${percentage}% var(--divider-width) 1fr`;
  } else {
    const percentage =
      ((point.clientX - containerRect.left) / containerRect.width) * 100;
    container.style.gridTemplateColumns =
      `${percentage}% var(--divider-width) 1fr`;
  }
};

const stopDragging = () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = 'default';

    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', stopDragging);
    document.removeEventListener('mouseleave', stopDragging);

    document.removeEventListener('touchmove', onDragging);
    document.removeEventListener('touchend', stopDragging);
    document.removeEventListener('touchcancel', stopDragging);
  }
};

divider.addEventListener('mousedown', handleDragStart);
divider.addEventListener('touchstart', handleDragStart);

// Copy Markdown to clipboard with button text feedback
const copyMarkdown = () => {
  // Save the current selection
  const selectionStart = $('markdown').selectionStart;
  const selectionEnd = $('markdown').selectionEnd;

  // Select all text, copy it, then restore the original selection
  $('markdown').select();
  document.execCommand('copy');

  // Restore the original selection and focus
  $('markdown').setSelectionRange(selectionStart, selectionEnd);
  $('markdown').focus();

  // Update the button text to indicate success
  const copyButton = document.querySelector('.copy-btn');
  copyButton.innerHTML = '<span class="copied-message">✔️ Copied!</span>';

  setTimeout(() => {
    copyButton.innerHTML = '📋';
  }, 2000);
};

// Expose functions to global scope
window.showHelp = showHelp;
window.closeHelp = closeHelp;
window.copyMarkdown = copyMarkdown;

}; // end initializeApp

export { initializeApp };
