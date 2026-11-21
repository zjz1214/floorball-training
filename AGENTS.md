# Project conventions

- This repository is a VitePress floorball training documentation site.
- Keep training pages in the existing topic directories, using descriptive Markdown filenames consistent with nearby pages.
- Keep site configuration and theme code in .vitepress/; keep static assets in public/.
- Keep dependency declarations in package.json and use package-lock.json for reproducible local installation with npm ci.
- Generated dependencies belong in node_modules/, caches in .vitepress/cache/, and build output in .vitepress/dist-site/. Do not commit these outputs.
- Ask the user before deleting files or directories; do not automatically clean project outputs.
- Start local development with npm run dev. Verify startup by requesting the printed local URL.
- After changing content, theme, or configuration, validate with npm run build.
- Ask the user before changing secrets or CI/CD configuration, pushing Git changes, or publishing/deploying.

## Imported 3v3 material

- Keep the 3v3 rules page at 软曲简介/3v3规则.md and link it from the introduction navigation and index.
- Keep its court diagram, original rules PDF, and Chinese handbook PDF in public/ with descriptive floorball-3v3 or iff-3v3 filenames.
- Preserve the event/version scope, original section references, and source verification date when adapting imported rules. Do not present event-specific rules as universal rules.
- Exclude AGENTS.md and DESIGN.md from published documentation pages.

## Dribbling discussion integration

- Integrate the user-provided discussion into 个人技术基础/运球.md, preserving existing video demonstrations.
- Label the six-action classification as a teaching framework, not an official IFF classification. Keep discussion provenance in project documentation rather than public teaching copy.
- Dribbling discussion reference: https://chatgpt.com/share/6abe6070-9f14-83e9-a5c0-ad62d7e52dce
- Keep search keywords and training progressions on this page; link existing detailed drills in 训练计划/带球与控制.md rather than duplicating them.

## Ball control and dribbling

- Keep 控球训练 and 运球 as separate sibling pages under 个人技术基础/.
- 控球训练 focuses on ball feel, forehand/backhand touches, pushes/pulls, and stick control; 运球 focuses on moving with the ball, direction/speed changes, turns, protection, feints, and breakthroughs.
- Explain the overlap and distinction near the start of both pages and link them to each other. Preserve existing content and videos.
- Keep navigation, category cards, homepage descriptions, and training-plan links consistent with this classification.

## Responsive navigation

- Keep the adaptive desktop navigation in .vitepress/theme/components/ResponsiveNav.vue; use theme.nav as the single source of menu data.
- Measure available width and move a suffix of categories into 更多 while preserving their order. 更多 contains only top-level category links to their overview pages, never second-level links. Keep the default mobile navigation below 768px.
- Each grouped category has an overview page in the same directory as its child pages; derive its overflow link from that directory, not the displayed category label.
- Reuse VitePress menu components and their keyboard interaction; measurement elements must be hidden from accessibility and focus.
- Validate home and content pages at desktop, narrow desktop, and mobile widths, including resizing back to a wider viewport.
- Build dropdown entries from sidebar roots through .local-editor/navigation.mjs, sharing editor-created pages, group labels and ordering. Top/mobile navigation shows at most category > page/group: group entries link to their first page (or category overview when empty), never expand third-level pages. Keep full hierarchy in the sidebar/editor. Preserve top-level category order and link-only items. 更多 still shows category links only. Keep the school-team overview's current-term entry visible while retaining prior-term records.

## Interactive layer order

- Keep the Live2D pet at layer 9 and page interaction targets at layer 12, below local navigation, the main navigation, and authentication overlays.
- Page links, buttons, inputs, media controls, labels, summaries, and custom TOC click targets must remain above the pet. Preserve their existing absolute/fixed positioning.
- Keep hero and author-card interaction ancestors above the pet so nested stacking contexts cannot swallow clickable targets.
- Give pager links an opaque theme background so a pet behind them cannot obscure their labels. Preserve pet interaction outside the pager buttons.

## School 3v3 adaptation

- Keep the detailed school adaptation at 软曲简介/校内3v3规则.md, next to the original IFF event handbook.
- Use a 22 m by 11 m court, with 1.6 m clear distance from the bottom rear edge of each goal cage to the inside of the end board. The school diagram assumes a 0.65 m bottom goal depth, placing each goal line 2.25 m from the end board; measure the actual cage depth for on-site positioning. Keep standard 5v5 goal creases (4 m deep by 5 m wide) and goalkeeper areas (1 m deep by 2.5 m wide); distinguish the rules of the two areas.
- Preserve the original event page and diagram. Keep the school court diagram in public/floorball-school-3v3-court.svg and clearly identify school modifications.
- Keep the agreed 3+1 players, 2 by 12 minutes with a 3-minute half-time interval, 2 m restart distance, goalkeeper throw-ins, and 5 m single-hit penalty shots. Keep 3v3 penalties separate from 5v5 crease rules.
- Explain that ordinary free-hits may be taken after the award signal without a second restart whistle, and do not require waiting for opponents to take position; opponents correctly retreating during a quick restart are not automatically penalised. Penalty shots require a start whistle. Distinguish non-contact feints from playing the ball once; identify this as an interpretation of sections 501 and 508, not an explicit IFF feint provision.
- Link video references to their publisher, explain different event rules, and do not invent timestamps or claim unverified footage.
- Validate the site build, local page response, diagram XML, and navigation links after editing.

## Local school 3v3 video

- Keep the user-provided goalkeeper throw-in clip at public/floorball-3v3-goalkeeper-throw-in.mp4 and embed it with native video controls on the school rules page.
- Emphasize the sequence: ball out, referee indicates the awarded direction, that team's goalkeeper stands up, retrieves a new ball, and throws it in.
- Preserve the source video outside the repository. Label supplied footage as an action demonstration without assuming its publisher or event.

- Keep the user-provided foul restart clip at public/floorball-3v3-free-hit.mp4, under the school rules page's centre-line free-hit section, with native video controls. Explain the awarded possession, nearest centre-line spot and 2 m defensive distance.

- Keep the supplied penalty-shot clip as a browser-compatible H.264 MP4 at public/floorball-3v3-penalty-shot.mp4, embedded under five-metre penalty shots. Preserve the source MKV outside the repository; emphasize one hit, no dribbling approach and no follow-up shot.

## Public-facing editorial conventions

- Write published pages for players, coaches and visitors. State the applicable rules and learning points directly.
- Keep implementation history, change summaries, user-supplied-file notes, chat references and repository storage details out of published copy; record such context in project documentation when needed.
- Preserve meaningful event/version scope, source attribution, verification dates and distinctions between school rules and IFF event rules.
- Video captions explain the demonstrated action and relevant rules; do not invent a publisher or competition for unattributed clips.

## Markdown emphasis

- When bold text ends with punctuation and is followed by Chinese prose, put a space after the closing ** delimiter so CommonMark recognizes the emphasis. Verify generated visible text does not expose emphasis delimiters.

## Rule demonstration cards

- Keep each school 3v3 demonstration video and its full related rule explanation in one shared h3 card. Use a bold paragraph for video captions instead of a separate h3/h4 card.

## School rule typography

- Scope reading styles to the rules-reading page class. Keep complete rules visible and preserve shared rule/video cards.
- Use readable line height, distinct list-item spacing, short bold rule labels and flow paragraphs. Maintain light/dark contrast and mobile spacing without changing rule meanings.

## Reading design system

- Follow DESIGN.md as the current project design specification. Its adoption scope, reading profiles and media constraints take precedence over legacy reference styles. Keep this document synchronized with approved design changes.
- The user approved applying DESIGN.md to every published page. Use reading-preview for introduction, equipment and explanatory reference pages; use technical-reading for all drills, tactics, training plans and team training records, preserving body typography and media geometry. Apply the shared palette globally, including home and navigation. Keep navigation structure, rules and media intact. Access behavior follows the direct-access convention below.
- Site-wide adoption is authorized. Preserve complete text and shared explanation/video cards; further media sizing or body typography changes for training pages require a separate proposal.
- Validate the build, text contrast, generated content and mobile/desktop light/dark rendering.

- For technical-reading pages, share light/dark palette tokens, reduce decorative borders and use a consistent heading hierarchy. Do not apply reading-preview typography or media-width overrides.

- Technical heading refinements may adjust heading font sizes and whitespace. Keep body and media sizing intact. On control-training, promote drill labels to semantic headings without adding card padding around media grids.

## Direct content access

- All published training pages are directly readable without answering a question or logging in.
- Do not mount authentication dialogs, content overlays or navigation login buttons. Render the Live2D pet on all pages without authentication conditions.
- Remove the question and accepted-answer settings from site configuration. Keep unused legacy authentication files until file deletion is explicitly authorized.
- Validate with npm run build and check generated pages and assets for authentication prompts and overlays.

## School rules PDF export

- Keep the full school rules PDF at public/floorball-school-3v3-rules.pdf, separate from the IFF event handbook.
- Keep export intermediates and rendered QA images under .vitepress/cache/pdf-school-rules/. Preserve complete rule explanations and the embedded court diagram. Shared PDFs must be self-contained: remove local preview and file links, omit video playback prompts and internal export notes, and keep only public official source links. Add page numbers.
- Verify heading/content completeness, Chinese text, and rendered page layout before delivery.

## Local visual content editor

- Keep the standalone local editor in .local-editor/: server.mjs for loopback-only file operations, document.mjs for lossless Markdown block handling, web/ for the UI, and tests/ for verification. Keep its launcher at 启动内容编辑器.cmd in the repository root. Do not publish editor files as site pages or assets.
- Store new imported media under public/editor-media/ with content-derived unique names. Preserve source files, prevent overwrites and restrict accepted uploads to image/video formats. Keep backups and draft/preview intermediates in .vitepress/cache/content-editor/; never commit them.
- Reuse DESIGN.md page classes and site styles. Keep original frontmatter, unknown Markdown/HTML and unchanged blocks verbatim. Preserve media dimensions/attributes unless explicitly edited. Protect existing custom sections from unsupported transformations.
- Bind only to 127.0.0.1. Validate write requests against same-origin/session checks and allowed paths; prevent path traversal and symbolic-link escapes. Detect external edits before saving, back up existing files and use atomic replacement. The editor must not expose Git operations or automatically publish.
- Newly created pages belong to existing topic directories. Register only their page entries in a local-editor page registry, and merge these entries into the existing sidebar without replacing existing navigation data. Do not rewrite .vitepress/config.ts for each new page.
- Validate untouched round trips across all published pages, changed-block serialization, media import, external-edit conflicts, path safety and browser workflows. Run editor tests and npm run build before delivery.
- Accept Explorer file drops directly onto the editing column, preserving the target page and insertion position throughout import. Automatically optimize imported video to H.264/yuv420p + AAC MP4 with faststart and a maximum 1920px edge, retaining original frame rate and aspect ratio. Preserve originals and failed/intermediate files under the ignored editor cache; publish only verified outputs. Show upload and conversion progress, queue one conversion at a time, and reuse verified output for identical source/policy. Use installed FFmpeg/FFprobe; never install global dependencies automatically.
- Table actions operate relative to the selected cell: insert above/below or left/right, delete the current row/column, preserve remaining data and support undo. New tables/cells are blank. Body cells align top-left; column and first-column row headers align centrally, consistently in the editor and website. Link selection browses existing pages and rendered heading anchors (including custom/duplicate anchors), with an external URL option; same-page draft headings are selectable before saving.

- Non-heading link targets use invisible persistent editor-block anchors bound to the block prefix. Add anchors only when the link is confirmed; detect conflicts and back up a different target page before adding its anchor. Preserve stable anchors when blocks move or their text changes. Link pickers offer separate page and section/block search.
- Links navigate on click in the editor and its preview. Keep a return-to-source stack restoring the source page, unsaved document/undo state, and editor/preview scroll positions. Existing link labels and destinations can be edited without duplicating links. Published same-tab internal article links also offer a return button restoring the original reading position; external/new-tab links keep normal browser behavior.
- Tables containing ordinary inline line breaks remain editable across save/reopen cycles. Preserve unknown HTML separately, but do not classify supported table cell breaks as protected code. Table/media blocks may have optional element titles, serialized as an element container with its child content; titles move with their elements. Untouched containers must round-trip exactly. Use compact title/content spacing and a single outer block gap without changing video sizing.
- Persist per-category page ordering in .local-editor/order.json, shared by the editor tree and VitePress sidebar. Reordering changes metadata only, never filenames or page contents; reject cross-category moves, duplicate/missing entries and stale writes. Back up ordering metadata before replacing it. New/unlisted pages append without disturbing saved order. Support drag and Alt+Up/Down ordering in the editor.
- Directory renaming updates display names in .local-editor/names.json for pages and categories. Apply names consistently to editor/link-picker/new-page category labels and website navigation/sidebar. Do not rename files, change URLs, rewrite links or overwrite article headings. Back up metadata, validate names and reject stale writes. Provide context-menu and F2 rename actions.
- Keep the third navigation level as category > collapsible group > page, using .local-editor/groups.json. Groups have stable generated IDs, display names and page membership; their array order controls group order, while order.json controls page order. Ungrouped pages remain at the category root. Support group creation/rename/reordering, moving pages between groups or back to the root, and group selection during page creation. Use metadata only; preserve source paths, article content and links. Reject cross-category membership, duplicate assignments and stale writes, and back up group metadata. Share grouping logic between the editor and VitePress sidebar; keep link selection aware of groups.
- Keep the floorball tactics workbench in .local-editor/web/tactics.js and tactics.css, storage/export endpoints in .local-editor/tactics.mjs, and the shared model/renderer/read-only player in public/tactics-runtime/. Store immutable, content-addressed tactic JSON and SVG posters in public/tactics/; keep video export frames, jobs and MP4 intermediates in .vitepress/cache/content-editor/tactics/. Do not copy third-party site source or artwork; implement the observed public workflow with original code and graphics.
- Offer standard 40x20 m and small 30x18 m courts, full/half views and portrait/landscape orientation. Keep goal lines 3.5 m from both end boards, goal cage rear edges 2.85 m from the end boards and the same crease geometry in both presets. Do not add a 3v3 preset or change existing school-rule pages. Small court is an editor preset, not a claim about official competition eligibility.
- Tactics are editable article blocks with persistent model references, independent title/description, frame notes/timings, stable object identities, interpolated playback and PNG/MP4 export. Save/reopen, undo, article moves and anchors must preserve edits. Published pages show a read-only responsive player. Validate models and asset paths, prevent overwrites and preserve export intermediates; encode deterministic PNG frames to H.264/yuv420p/faststart MP4 using installed FFmpeg. Test geometry, interpolation, model rejection, storage/export and browser editing/save/reopen/public playback.
- Dribbling paths use a wavy arrow bound to a player in the same frame; draw from a nearby player to attach. Dashed straight/curved arrows animate a ball from start to end. Reuse a bound/nearby ball without rendering a duplicate, otherwise show a deterministic virtual ball. Each step runs its motion over that step's duration, including a single/last step; drawing waves mark a route, while the player follows its centreline. New steps inherit action endpoints and balls without replaying old action arrows. Keep legacy models readable, reject dangling/duplicate explicit actor or ball bindings, and use the same motion sampler for workbench, public playback and MP4 export.
- Solid straight/curved arrows represent runs without the ball. Attach when drawn from a player, and infer a nearby player for older unbound arrows; do not create, consume or move a ball for these runs. Retain unbound solid annotations when no player is nearby. Explicit player bindings must be unique across dribbling and running routes in a step; new steps inherit run endpoints and remove completed run routes.
- Carry completed movement actors into subsequent steps at their endpoints when those steps omit them; do not fade out a runner merely because a pre-existing next step lacks its ID. Respect explicit poses in later steps and optional per-frame removedIds for intentional actor removal. Keep sampling and frame resolution pure, preserve old source files, and make editing, public playback and export agree at step boundaries and at the animation end.
- Make inherited actors editable when entering a step through the timeline, scrubbing, pausing or clicking the canvas. Actor removal starts at the selected step and applies to subsequent steps and owned routes, preserving earlier motion; explicit removal must defeat automatic carry and be undoable. Give canvas selection keyboard focus so Delete targets the selected object rather than a previously focused time/property input.
