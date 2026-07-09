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

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  hr: '---'
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
  content: 'When on, every newline in the markdown is preserved in the richtext. When off, strict markdown rules apply. Use a trailing double space to force a newline in that case.'
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

// Convert HTML to Markdown. The asciiSpaces call is load-bearing: Quill's
// getSemanticHTML converts every ordinary space to "&nbsp;"
// (https://github.com/slab/quill/issues/4509), which turndown would
// otherwise pass through as literal U+00A0 characters.
const htmlToMarkdown = (html) => {
  const cleanedHtml = cleanTableHtml(html);

  return asciiSpaces(turndownService.turndown(cleanedHtml));
};

// Convert Markdown to HTML with GFM tables enabled. (The breaks option is
// owned by the newline-mode toggle; see applyNewlineMode.)
marked.setOptions({
  gfm: true
});
const markdownToHtml = (markdown) => {
  let html = marked.parse(markdown);

  // Transform tables for Quill Better Table compatibility
  if (html.includes('<table')) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

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
    });

    html = temp.innerHTML;
  }

  return html;
};

// Sync changes from Quill editor to Markdown textarea
quill.on('text-change', () => {
  if (isUpdating) return;
  isUpdating = true;
  const html = quill.getSemanticHTML();
  //if (html.includes('table')) { console.log('HTML from Quill:', html) }

  const markdown = htmlToMarkdown(html);
  //if (html.includes('table')) { console.log('Markdown output:', markdown) }

  markdownTextarea.value = markdown;
  updateWordCount();
  saveContent();
  isUpdating = false;
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
  marked.setOptions({ breaks: preserveNewlines.checked });
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
