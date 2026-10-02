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

## Interactive layer order

- Keep the Live2D pet at layer 9 and page interaction targets at layer 12, below local navigation, the main navigation, and authentication overlays.
- Page links, buttons, inputs, media controls, labels, summaries, and custom TOC click targets must remain above the pet. Preserve their existing absolute/fixed positioning.
- Keep hero and author-card interaction ancestors above the pet so nested stacking contexts cannot swallow clickable targets.
- Give pager links an opaque theme background so a pet behind them cannot obscure their labels. Preserve pet interaction outside the pager buttons.

## School 3v3 adaptation

- Keep the detailed school adaptation at 软曲简介/校内3v3规则.md, next to the original IFF event handbook.
- Use a 24 m by 12 m court with standard 5v5 goal creases (4 m deep by 5 m wide) and goalkeeper areas (1 m deep by 2.5 m wide); distinguish the rules of the two areas.
- Preserve the original event page and diagram. Keep the school court diagram in public/floorball-school-3v3-court.svg and clearly identify school modifications.
- Keep the agreed 3+1 players, 2 by 10 minutes, 2 m restart distance, goalkeeper throw-ins, and 5 m single-hit penalty shots. Keep 3v3 penalties separate from 5v5 crease rules.
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
- The user approved applying DESIGN.md to every published page. Use reading-preview for introduction, equipment and explanatory reference pages; use technical-reading for all drills, tactics, training plans and team training records, preserving body typography and media geometry. Apply the shared palette globally, including home and navigation. Keep navigation structure, auth behavior, rules and media intact.
- Site-wide adoption is authorized. Preserve complete text and shared explanation/video cards; further media sizing or body typography changes for training pages require a separate proposal.
- Validate the build, text contrast, generated content and mobile/desktop light/dark rendering.

- For technical-reading pages, share light/dark palette tokens, reduce decorative borders and use a consistent heading hierarchy. Do not apply reading-preview typography or media-width overrides.

- Technical heading refinements may adjust heading font sizes and whitespace. Keep body and media sizing intact. On control-training, promote drill labels to semantic headings without adding card padding around media grids.
