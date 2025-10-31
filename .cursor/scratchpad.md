Background and Motivation

We need multi-document support with persistent storage of Lexical editor state. Users should be able to create multiple documents, list them, open one to edit collaboratively (Liveblocks remains), and autosave serialized Lexical state to the database. Authentication gates access; each document belongs to a user.

Key Challenges and Analysis

- Persisting Lexical state: follow Lexical guide; use `LexicalOnChangePlugin` (preferred) to capture `editorState`, serialize with `editorState.toJSON()` then `JSON.stringify`, store in Prisma JSON column.
- Multi-document routing: use Next.js App Router dynamic route `app/editor/[id]/page.tsx` plus an index `app/editor/page.tsx` to list/create.
- Autosave: debounce client updates to avoid excessive writes; handle initial load from server and rehydrate Lexical with `editor.update(() => $parseSerializedNode(…))` via Lexical import utilities (or load into composer `initialEditorState`). Prefer LexicalOnChangePlugin in practice; we can implement a small OnChange plugin to trigger debounced save.
- Access control: documents scoped by `userId`; server verifies ownership.
- API surface: tRPC procedures for CRUD (create, list, get by id, update content/title). Use Zod schemas and return minimal payloads.
- Prisma model: `Document` with `id` (cuid), `userId` FK, `title`, `content` JSON, timestamps.
- Liveblocks room: continue using existing `Room` wrapper; derive unique room id per document for collaboration.

High-level Task Breakdown

1. Add Prisma model for documents

- Success criteria: `Document` model in `prisma/schema.prisma` with fields {id, userId, title, content JSON, createdAt, updatedAt}; migration runs locally.

2. Generate Prisma client and wire repository utilities

- Success criteria: `src/lib/prisma.ts` already exists; ensure client works with new model; add `src/server/api/routers/document.ts` queries using Prisma.

3. Add tRPC router for documents

- Success criteria: Procedures: `createDocument({title?})`, `getDocuments()`, `getDocumentById({id})`, `updateDocumentContent({id, content, title?})`. Ownership checks using session user id. Router added to `appRouter`.

4. Editor autosave integration (Lexical guide compliant)

- Success criteria: Use `LexicalOnChangePlugin` to receive `editorState`; serialize via `editorState.toJSON()` then `JSON.stringify`; maintain local React state for the serialized string; trigger debounced (≈800ms) tRPC `updateDocumentContent` with `{ id, content: stringifiedJSON }`. Do not attempt to control editor; only persist. Gate saving until initial content has been loaded once.
  - API contract: `content` accepted as stringified JSON; server parses and stores as JSON field; validates size and structure.
  - Edge cases: debounce resets on rapid changes; ignore identical payloads to reduce writes; handle error with toast and optional retry.

5. Document pages and routing

- Success criteria: `app/editor/page.tsx` lists user documents with Create button; `app/editor/[id]/page.tsx` renders `Room` + `Editor` tied to document id; loads initial content from server and passes to composer via `initialEditorState` prop (using parsed JSON), without setting state directly on the editor.

Documents List Page Spec (app/editor/page.tsx)

- Data fetching: Server Component fetches current user's documents (via tRPC server caller or direct Prisma with session in server context).
- UI layout: Responsive grid (e.g., `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`). Cards are vertical rectangles with title, preview excerpt, updatedAt. Use DaisyUI `card` styles, avoid gray per user rule.
- Preview: Derive plain text from stored Lexical JSON on the server; take first ~180 chars or 2 lines. Fallback to "Untitled"/"Empty" as needed.
- Interactions: Clicking a card navigates to `/editor/[id]`. Include a prominent "New Document" button that creates a doc then routes to it (disable while submitting).
- Accessibility: Card has aria-label with title; entire card is a single interactive link with no dead areas.

6. Liveblocks room id per document

- Success criteria: `Room` uses room id like `writer-doc-${documentId}` so collaboration is scoped per document.

7. Basic UI/UX per user rules

- Success criteria: no gray colors; inputs within `<form>`; buttons disable on submit; use DaisyUI/Tailwind; accessible labels; smooth loading states and error messaging.

8. Tests (minimal)

- Success criteria: Unit tests for document router zod validation and ownership checks; integration test for create/list/update with a mocked session.

9. Performance and safety

- Success criteria: Debounce ~800ms; ignore unchanged payloads; server validates JSON size limit; handle 413 gracefully; optimistic UI and rollback on error toast.

Implementation Notes (Saving Lexical State)

- Use `LexicalOnChangePlugin` from `@lexical/react` inside `Editor` component.
- onChange handler signature: `(editorState: EditorState) => void`.
- Convert to string: `JSON.stringify(editorState.toJSON())` and store in React state for comparison and debounce.
- Initial load: parse stored JSON and pass as `initialEditorState` to `LexicalComposer` config; do not call `editor.setEditorState` directly.
- Ensure autosave does not fire during initial hydrate: set a `hasLoadedInitial` ref before enabling saves.

Project Status Board

- [x] Add Prisma Document model and run migration
- [x] Implement tRPC document router and add to appRouter
- [x] Implement debounced autosave plugin in editor
- [x] Create editor routes: list page and dynamic `[id]`
- [x] Wire initial load of content into Lexical and Liveblocks room per doc
- [x] Add basic list/create UI and navigation
- [x] Polish UI/UX per user rules (error toasts, validation)
- [x] Add server-side validation for JSON size limits
- [ ] Add tests for router validation and ownership (optional)

Current Status / Progress Tracking

Executor completed:

1. ✅ Added `Document` model to Prisma schema with userId, title, content (JSON), timestamps. Fixed relation to User.
2. ✅ Updated tRPC context and added `protectedProcedure` concept via session checks in document router.
3. ✅ Created `documentRouter` with procedures: `create`, `getAll`, `getById`, `updateContent`. All procedures verify ownership via `userId` in session context.
4. ✅ Added router to `appRouter` in root.ts.
5. ✅ Implemented autosave using `LexicalOnChangePlugin` with debounced (800ms) save via tRPC `updateContent`. Skips unchanged content and gates on initial load completion.
6. ✅ Updated `Editor` component to accept `documentId` and `initialContent` props. Uses `liveblocksConfig` with initial editor state.
7. ✅ Created `app/editor/[id]/page.tsx` for dynamic document editing. Fetches document via Prisma, passes content to Editor.
8. ✅ Updated `Room` component to accept `documentId` and generate room ID `writer-doc-${documentId}` for per-document collaboration.
9. ✅ Created `app/editor/page.tsx` as documents list page with "Create Document" button and grid view of documents. Fixed preview extraction to handle Lexical JSON structure.
10. ✅ Added error handling with react-hot-toast for save/create operations.
11. ✅ Added server-side validation for JSON content size (10MB limit) with proper error handling.
12. ✅ Fixed Liveblocks room creation to handle existing rooms gracefully.
13. ✅ Resolved all TypeScript linting errors.

All core functionality is implemented and working. Document creation, listing, editing with autosave, and preview extraction are all functional.

Executor's Feedback or Assistance Requests

- If Liveblocks requires explicit room configuration per document beyond id, note constraints here.
- Confirm if title should be editable inline in toolbar or separate field on list page.

Lessons

- Serialize Lexical via `editorState.toJSON()` then `JSON.stringify` before persistence.
- Debounce autosave to avoid excessive writes; gate on initial load completion.
