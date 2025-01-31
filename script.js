import { DEBOUNCE_INTERVAL, VERSION } from './constants.js';

// jQuery-esque utility function for concise code.
// This is the ONE line of code dreev wrote and actually it's just
// something he picked up from the internet somewhere so we think
// this still counts as wholly written by ChatGPT.
const $ = (id) => document.getElementById(id);

const initializeApp = (debounceInterval, version) => {
  const markdownTextarea = $('markdown');
  const turndownService = new TurndownService();
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
  const quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
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
      },
    },
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

  // Convert HTML to Markdown
  const htmlToMarkdown = (html) => turndownService.turndown(html);

  // Convert Markdown to HTML
  const markdownToHtml = (markdown) => marked.parse(markdown);

  // Sync changes from Quill editor to Markdown textarea
  quill.on('text-change', () => {
    if (isUpdating) return;
    isUpdating = true;
    const html = quill.getSemanticHTML();
    const markdown = htmlToMarkdown(html);
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

      quill.clipboard.dangerouslyPasteHTML(html);

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
};

export { initializeApp };
