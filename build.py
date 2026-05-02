"""Build static site from manual.md. Outputs to _site/."""
import os, re, shutil
from markdown import markdown
from markdown.extensions import tables, fenced_code, codehilite
from jinja2 import Environment, FileSystemLoader

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.join(BASE_DIR, '_site')
MD_FILE = os.path.join(BASE_DIR, 'manual.md')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
VIDEO_DIR = os.path.join(BASE_DIR, 'videos')

def slugify(text):
    """Generate URL-safe slug from Chinese or ASCII text."""
    # For Chinese text, use the text itself as the filename
    # Only replace unsafe chars
    safe = text.strip()
    # Remove leading "N.N " before "N. " to avoid partial stripping
    safe = re.sub(r'^\d+\.\d+\s*', '', safe)
    safe = re.sub(r'^\d+\.\s*', '', safe)
    # Remove problematic chars but keep Chinese, letters, digits
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', safe)
    safe = safe.strip()
    return safe if safe else 'section'

def split_sections(md_text):
    """Split markdown into H1 sections with H2 subsections.
    Returns: (overview_text, list_of_h1_sections)
    Each H1 section: {title, slug, content_md, children: [{title, slug, content_md}]}
    """
    lines = md_text.split('\n')

    # Find all heading positions
    positions = []  # (line_idx, level, title)
    for i, line in enumerate(lines):
        h1_match = re.match(r'^#\s+(.+)', line)
        h2_match = re.match(r'^##\s+(.+)', line)
        if h1_match:
            title = h1_match.group(1).strip()
            # Clean trailing content after Chinese colon
            title = re.split(r'[：:]\s*', title)[0].strip()
            positions.append((i, 1, title))
        elif h2_match:
            title = h2_match.group(1).strip()
            title = re.split(r'[：:]\s*', title)[0].strip()
            positions.append((i, 2, title))

    if not positions:
        return md_text, []

    # The first H1 heading is the document title, treat its content as overview
    # Find the first H1 position
    first_h1_idx = next((i for i, (_, level, _) in enumerate(positions) if level == 1), 0)
    first_h1_pos = positions[first_h1_idx][0]

    # Overview: from first heading to the next H1 heading (or end)
    # Find the second H1
    second_h1_pos = len(lines)
    for j in range(first_h1_idx + 1, len(positions)):
        if positions[j][1] == 1:
            second_h1_pos = positions[j][0]
            break

    overview = '\n'.join(lines[first_h1_pos:second_h1_pos]).strip()

    # Build tree - skip the first H1 (it's the overview/document title)
    h1_sections = []
    current_h1 = None

    for idx, (pos, level, title) in enumerate(positions):
        if idx == first_h1_idx:
            continue  # Skip overview H1

        # Determine content range
        next_pos = len(lines)
        for j in range(idx + 1, len(positions)):
            if positions[j][1] <= level:
                next_pos = positions[j][0]
                break

        content = '\n'.join(lines[pos:next_pos]).strip()

        if level == 1:
            current_h1 = {
                'title': title,
                'slug': slugify(title),
                'content_md': content,
                'children': []
            }
            h1_sections.append(current_h1)
        elif level == 2 and current_h1 is not None:
            current_h1['children'].append({
                'title': title,
                'slug': slugify(title),
                'content_md': content,
            })

    return overview, h1_sections

def process_callouts(html):
    """Convert > [!TIP] blocks to styled divs."""
    # Markdown renders > [!TIP] as <blockquote><p>[!TIP] ...</p></blockquote>
    # Replace the [TIP] marker with styled callout
    def replace_tip(match):
        inner = match.group(1)
        inner = inner.replace('[!TIP]', '').strip()
        inner = inner.replace('<strong>TIP</strong>', '')
        return f'<div class="callout-tip"><div class="callout-title">TIP</div>{inner}</div>'

    html = re.sub(
        r'<blockquote>\s*<p>\[!TIP\](.*?)</p>\s*</blockquote>',
        replace_tip,
        html,
        flags=re.DOTALL
    )
    return html

def normalize_indent(text):
    """Strip base indentation from markdown content so list indents don't become code blocks."""
    lines = text.split('\n')
    # Skip the heading line (starts with #) for min-indent calculation
    non_headings = []
    has_heading = False
    for line in lines:
        if line.startswith('#'):
            has_heading = True
            continue
        if line.strip():  # non-empty
            # Count leading spaces/tabs
            stripped = line.lstrip('\t ')
            indent = len(line) - len(stripped)
            non_headings.append((indent, line, stripped))

    if not non_headings:
        return text

    # Find minimum indent among content lines
    min_indent = min(nh[0] for nh in non_headings)

    # De-indent all lines by min_indent
    result = []
    for line in lines:
        if line.startswith('#') or not line.strip():
            result.append(line)
        else:
            stripped = line.lstrip('\t ')
            current_indent = len(line) - len(stripped)
            if current_indent >= min_indent:
                result.append('    ' * ((current_indent - min_indent) // 4) + stripped)
            else:
                result.append(line)
    return '\n'.join(result)

def md_to_html(md_text):
    """Convert markdown to HTML with extensions."""
    # Normalize tab indentation: replace leading tabs with 4 spaces per level
    # This prevents tabs from being interpreted as code blocks while preserving list nesting
    lines = md_text.split('\n')
    normalized = []
    for line in lines:
        if line.startswith('\t'):
            # Count leading tabs and replace with 4 spaces each
            stripped = line.lstrip('\t')
            tabs = len(line) - len(stripped)
            normalized.append('    ' * tabs + stripped)
        else:
            normalized.append(line)
    md_text = '\n'.join(normalized)

    html = markdown(
        md_text,
        extensions=['tables', 'fenced_code', 'codehilite']
    )
    html = process_callouts(html)
    return html

def build_page(h1, h2, tree, base_path):
    """Build a section page (either H1 overview or H2 detail)."""
    if h2:
        heading = h2
        content_md = h2['content_md']
        sub_pages = None
    else:
        heading = h1
        # For H1 overview page, just show the H1 content
        content_md = h1['content_md']
        sub_pages = h1['children'] if h1['children'] else None

    content_html = md_to_html(normalize_indent(content_md))
    content_html = content_html.replace('src="static/', f'src="{base_path}static/')
    content_html = content_html.replace('src="videos/', f'src="{base_path}videos/')

    # Calculate breadcrumb
    breadcrumb = []
    if h2:
        breadcrumb.append({'title': h1['title'], 'url': f'{h1["slug"]}/index.html'})
        breadcrumb.append({'title': h2['title'], 'url': None})

    # Calculate prev/next (flat list of all pages)
    all_pages = []
    for h in tree:
        all_pages.append({'title': h['title'], 'url': f'{h["slug"]}/index.html', 'h1': h, 'h2': None})
        for c in h['children']:
            all_pages.append({'title': c['title'], 'url': f'{h["slug"]}/{c["slug"]}.html', 'h1': h, 'h2': c})

    current_url = (f'{h1["slug"]}/{h2["slug"]}.html') if h2 else f'{h1["slug"]}/index.html'
    current_idx = next((i for i, p in enumerate(all_pages) if p['url'] == current_url), -1)

    prev_page = all_pages[current_idx - 1] if current_idx > 0 else None
    next_page = all_pages[current_idx + 1] if current_idx < len(all_pages) - 1 else None

    return {
        'heading': heading,
        'content_html': content_html,
        'sub_pages': sub_pages,
        'tree': tree,
        'current_section': h1['slug'],
        'breadcrumb': breadcrumb,
        'prev_page': prev_page,
        'next_page': next_page,
        'base_path': base_path,
    }

def main():
    # Load markdown
    with open(MD_FILE, 'r', encoding='utf-8') as f:
        md_text = f.read()

    overview, tree = split_sections(md_text)
    overview_html = md_to_html(normalize_indent(overview))
    overview_html = overview_html.replace('src="static/', 'src="./static/')
    overview_html = overview_html.replace('src="videos/', 'src="./videos/')

    # Clean site dir
    if os.path.exists(SITE_DIR):
        shutil.rmtree(SITE_DIR)

    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    base_path = './'  # Relative base path from root of site

    # Render index page
    tpl_index = env.get_template('index.html')
    index_html = tpl_index.render(
        overview_html=overview_html,
        tree=tree,
        current_section='index',
        base_path=base_path,
        breadcrumb=None,
        prev_page=None,
        next_page=None,
    )
    os.makedirs(SITE_DIR, exist_ok=True)
    with open(os.path.join(SITE_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_html)

    # Render H1 and H2 pages
    tpl_section = env.get_template('section.html')
    for h1 in tree:
        h1_dir = os.path.join(SITE_DIR, h1['slug'])
        os.makedirs(h1_dir, exist_ok=True)

        # H1 overview page
        ctx = build_page(h1, None, tree, '../')
        ctx['base_path'] = '../'  # In subfolder, go up one level
        html = tpl_section.render(**ctx)
        with open(os.path.join(h1_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)

        # H2 detail pages
        for h2 in h1['children']:
            ctx = build_page(h1, h2, tree, '../../')
            ctx['base_path'] = '../../'
            html = tpl_section.render(**ctx)
            with open(os.path.join(h1_dir, f'{h2["slug"]}.html'), 'w', encoding='utf-8') as f:
                f.write(html)

    # Copy static assets
    if os.path.exists(STATIC_DIR):
        shutil.copytree(STATIC_DIR, os.path.join(SITE_DIR, 'static'))
    if os.path.exists(VIDEO_DIR):
        shutil.copytree(VIDEO_DIR, os.path.join(SITE_DIR, 'videos'))

    print(f'Built to {SITE_DIR}')
    print(f'  Pages: {1 + len(tree) + sum(len(h["children"]) for h in tree)}')
    print(f'  H1 sections: {len(tree)}')
    for h1 in tree:
        print(f'    {h1["title"]} ({len(h1["children"])} sub-pages)')

if __name__ == '__main__':
    main()
