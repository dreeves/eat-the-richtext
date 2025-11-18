// import { DEBOUNCE_INTERVAL, VERSION } from './constants.js';

// jQuery-esque utility function for concise code.
// This is the ONE line of code dreev wrote and actually it's just
// something he picked up from the internet somewhere so we think
// this still counts as wholly written by ChatGPT.
const $ = (id) => document.getElementById(id);

const initializeApp = (debounceInterval, version) => {

const markdownTextarea = $('markdown');

// Register Quill Better Table module
if (window.quillBetterTable) {
  Quill.register({
    'modules/better-table': window.quillBetterTable
  }, true);
  console.log('Quill Better Table module registered');
} else {
  console.warn('Quill Better Table not available');
}

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
  console.log('Table support enabled via GFM plugin');
} else {
  console.error('Turndown GFM plugin not loaded!');
}

const divider = $('divider');
const container = document.querySelector('.container');
let isDragging = false;

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

// Add clipboard matchers for elements Quill doesn't support natively
modules.clipboard = {
  matchers: [
    // Convert <hr> to plain text "---" when pasting
    ['HR', (node, delta) => {
      const Delta = Quill.import('delta');
      return new Delta().insert('\n---\n');
    }]
  ]
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

const quill = new Quill('#editor', {
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

let isUpdating = false;

// Load content from local storage
window.onload = () => {
  const savedHtml = localStorage.getItem('quillContent');
  const savedMarkdown = localStorage.getItem('markdownContent');
  if (savedHtml) quill.clipboard.dangerouslyPasteHTML(savedHtml);
  if (savedMarkdown) markdownTextarea.value = savedMarkdown;
  document.getElementById('version').innerText = version;
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

// Convert HTML to Markdown
const htmlToMarkdown = (html) => {
  const cleanedHtml = cleanTableHtml(html);
  
  return turndownService.turndown(cleanedHtml);
};

// Convert Markdown to HTML with GFM tables enabled
marked.setOptions({
  gfm: true,
  breaks: true
});
const markdownToHtml = (markdown) => {
  let html = marked.parse(markdown);

  // Convert <hr> to paragraph with dashes since Quill doesn't support hr
  html = html.replace(/<hr\s*\/?>/gi, '<p>---</p>');

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
  
  // Debug: log HTML to see what Quill produces
  if (html.includes('table')) {
    console.log('HTML from Quill:', html);
  }
  
  const markdown = htmlToMarkdown(html);
  
  // Debug: log markdown conversion
  if (html.includes('table')) {
    console.log('Markdown output:', markdown);
  }
  
  markdownTextarea.value = markdown;
  saveContent();
  isUpdating = false;
});

// Sync changes from Markdown textarea to Quill editor
$('markdown').addEventListener(
  'input',
  debounce(() => {
    if (isUpdating) return;
    isUpdating = true;
    const markdown = $('markdown').value;
    const html = markdownToHtml(markdown);

    const start = $('markdown').selectionStart;
    const end = $('markdown').selectionEnd;

    try {
      quill.clipboard.dangerouslyPasteHTML(html);
    } catch (error) {
      console.error('Error pasting markdown to Quill:', error);
    }

    $('markdown').focus();
    $('markdown').setSelectionRange(start, end);

    saveContent();
    isUpdating = false;
  }, debounceInterval)
);

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

// Handle drag for both mouse and touch events
const handleDragStart = (e) => {
  isDragging = true;
  document.body.style.cursor = 'col-resize';

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
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const offset = clientX - containerRect.left;
  const percentage = (offset / containerRect.width) * 100;

  container.style.gridTemplateColumns =
    `${percentage}% 5px ${100 - percentage}%`;
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
