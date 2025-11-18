# Quill Better Table Integration

## Problem
Quill Better Table requires specific HTML structure (colgroup with width attributes, wrapper divs) that standard markdown tables don't have. This causes "Cannot read properties of undefined (reading 'width')" errors.

## Solution

### 1. Clipboard Matchers
Prevent Quill Better Table from auto-processing externally pasted tables (which lack the required structure):

```javascript
modules.clipboard.matchers = [
  ['TABLE', () => new (Quill.import('delta'))()],
  ['TBODY', () => new (Quill.import('delta'))()],
  // ... etc
]
```

### 2. Markdown→HTML Conversion
When converting markdown tables to HTML, add the required Quill Better Table structure:
- Add `<colgroup>` with `<col width="150">` elements
- Wrap table in `<div class="quill-better-table-wrapper">`

### 3. HTML→Markdown Conversion
Remove Quill Better Table artifacts:
- Strip `colgroup` elements
- Remove wrapper divs
- Remove data-* attributes
- Convert first row to `<thead>` with `<th>` elements for GFM compatibility

## Bidirectional Editing
This allows users to:
- Edit tables in rich text (left) → see markdown (right)
- Edit markdown tables (right) → see rich text (left)
- Both work seamlessly with proper structure preservation
