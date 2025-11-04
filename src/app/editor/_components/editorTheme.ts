/**
 * Comprehensive Lexical editor theme configuration using Tailwind CSS
 * Maps Tailwind utility classes to editor nodes for styling
 */
export const editorTheme = {
  // Paragraph: margin bottom 0.8em
  paragraph: "mb-[0.8em] relative",
  // Quote: left margin, left padding, border, italic, muted color
  quote: "m-0 ml-4 pl-4 border-l-4 border-border text-muted-foreground italic",
  // Headings with various sizes and weights
  heading: {
    h1: "text-[2em] font-bold mb-2 leading-[1.2]",
    h2: "text-[1.5em] font-semibold mb-2 leading-[1.3]",
    h3: "text-[1.25em] font-semibold mb-2 leading-[1.4]",
    h4: "text-[1.125em] font-semibold mb-2 leading-[1.4]",
    h5: "text-base font-semibold mb-2 leading-[1.5]",
    h6: "text-sm font-semibold mb-2 leading-[1.5]",
  },
  // Lists with proper spacing and padding
  list: {
    nested: {
      listitem: "list-none",
    },
    ol: "p-0 mb-[0.8em] pl-6",
    ul: "p-0 mb-[0.8em] pl-6",
    listitem: "my-1",
    listitemChecked: "line-through relative ml-2 mr-2 pl-6 pr-2 list-none outline-none before:content-['✓'] before:w-4 before:h-4 before:top-[0.125em] before:left-0 before:cursor-pointer before:absolute before:border before:border-primary before:bg-primary before:text-primary-foreground before:rounded before:flex before:items-center before:justify-center before:text-xs",
    listitemUnchecked: "relative ml-2 mr-2 pl-6 pr-2 list-none outline-none before:content-[''] before:w-4 before:h-4 before:top-[0.125em] before:left-0 before:cursor-pointer before:absolute before:border before:border-[var(--border)] before:bg-[var(--background)] before:rounded",
  },
  // Hashtag: background, padding, rounded
  hashtag: "bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-sm",
  // Image: inline block, no user select, max width, margin
  image: "cursor-default inline-block relative select-none max-w-full h-auto my-2",
  // Link: color, underline, hover transition
  link: "text-chart-1 underline cursor-pointer transition-colors duration-200 ease hover:text-chart-2",
  // Text formatting
  text: {
    bold: "font-bold",
    code: "bg-muted px-1 py-0.5 rounded text-sm font-mono",
    italic: "italic",
    strikethrough: "line-through",
    subscript: "text-xs align-sub",
    superscript: "text-xs align-super",
    underline: "underline",
    underlineStrikethrough: "underline line-through",
  },
  // Code block: background, padding, rounded, monospace
  code: "bg-muted text-foreground font-mono block px-4 py-3 mb-[0.8em] rounded-lg overflow-x-auto relative text-sm leading-[1.5] dark:bg-card",
  // Code highlight tokens - using chart colors for syntax highlighting
  codeHighlight: {
    atrule: "text-chart-4",
    attr: "text-chart-4",
    boolean: "text-chart-1",
    builtin: "text-chart-2",
    cdata: "text-muted-foreground italic",
    char: "text-chart-2",
    class: "text-primary",
    "class-name": "text-primary",
    comment: "text-muted-foreground italic",
    constant: "text-chart-1",
    deleted: "text-chart-1",
    doctype: "text-muted-foreground italic",
    entity: "text-chart-3",
    function: "text-primary",
    important: "text-chart-5",
    inserted: "text-chart-2",
    keyword: "text-chart-4",
    namespace: "text-chart-5",
    number: "text-chart-1",
    operator: "text-chart-3",
    prolog: "text-muted-foreground italic",
    property: "text-chart-1",
    punctuation: "text-muted-foreground",
    regex: "text-chart-5",
    selector: "text-chart-2",
    string: "text-chart-2",
    symbol: "text-chart-1",
    tag: "text-chart-1",
    url: "text-chart-3",
    variable: "text-chart-5",
  },
} as const;

