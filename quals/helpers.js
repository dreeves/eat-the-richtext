// Shared helpers for quals.

// Grab the Quill instance from the page (it's scoped inside initializeApp,
// but Quill.find recovers it from the DOM).
export const quillEval = (fn) =>
  `(${fn})(Quill.find(document.querySelector('#richtext')))`;
