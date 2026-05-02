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

        # Determine content range (up to next heading of same or higher level)
        next_pos = len(lines)
        first_child_pos = len(lines)
        for j in range(idx + 1, len(positions)):
            if positions[j][1] <= level:
                next_pos = positions[j][0]
                break
            if first_child_pos == len(lines) and positions[j][1] > level:
                first_child_pos = positions[j][0]

        content = '\n'.join(lines[pos:next_pos]).strip()

        # Intro is content from this heading to its first child heading
        intro = '\n'.join(lines[pos:first_child_pos]).strip()

        if level == 1:
            current_h1 = {
                'title': title,
                'slug': slugify(title),
                'content_md': content,
                'intro_md': intro,
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

def tab_to_spaces(text):
    """Convert leading tabs to 4-space indentation."""
    lines = text.split('\n')
    result = []
    for line in lines:
        if '\t' in line and line.startswith('\t'):
            stripped = line.lstrip('\t')
            tabs = len(line) - len(stripped)
            result.append('    ' * tabs + stripped)
        else:
            result.append(line)
    return '\n'.join(result)


def escape_repetition_marks(text):
    """Escape *N (repetition counter like 动作一*20) so it's not parsed as emphasis."""
    # * followed by digit, not preceded by * (so **bold** is safe)
    return re.sub(r'(?<!\*)\*(?=\d)', r'\\*', text)


def preprocess_md(text):
    """Prepare markdown text for HTML conversion (tab/spaces already normalized globally)."""
    # Reduce deep indentation on HTML tags to prevent code-block treatment.
    # 8+ space indent = code block, but <video>/<img> continuations should be 4 spaces max.
    lines = text.split('\n')
    result = []
    for line in lines:
        stripped = line.lstrip(' ')
        indent = len(line) - len(stripped)
        if indent > 4 and (stripped.startswith('<video') or stripped.startswith('<img')):
            result.append('    ' + stripped)
        else:
            result.append(line)
    return '\n'.join(result)

def build_static_map(static_dir):
    """Build mapping from extensionless name to full filename for static assets."""
    mapping = {}
    if not os.path.exists(static_dir):
        return mapping
    for fname in os.listdir(static_dir):
        name, ext = os.path.splitext(fname)
        mapping[name] = fname
    return mapping


def fix_image_extensions(html, static_map):
    """Add missing file extensions to image src paths."""
    if not static_map:
        return html

    def replace_src(match):
        prefix = match.group(1)  # e.g. "../" or "../../" or "./" or ""
        basename = match.group(2)
        if basename in static_map:
            return f'src="{prefix}static/{static_map[basename]}"'
        return match.group(0)  # no change

    html = re.sub(
        r'src="((?:\.\./)*)static/([^"]+)"',
        replace_src,
        html
    )
    return html


def md_to_html(md_text):
    """Convert markdown to HTML with extensions."""
    md_text = preprocess_md(md_text)
    html = markdown(
        md_text,
        extensions=['tables', 'fenced_code', 'codehilite']
    )
    html = process_callouts(html)
    return html


def strip_heading_line(md_text, level):
    """Remove the first heading line and trim common base indent from remaining content."""
    prefix = '#' * level + ' '
    lines = md_text.split('\n')
    result = []
    skipped_heading = False
    for line in lines:
        if not skipped_heading and line.startswith(prefix):
            skipped_heading = True
            continue
        if skipped_heading and not result and not line.strip():
            continue
        result.append(line)

    if not result:
        return ''

    # Calculate common base indent from non-empty, non-heading lines
    non_headings = []
    for line in result:
        if line.strip() and not line.startswith('#'):
            stripped = line.lstrip(' ')
            indent = len(line) - len(stripped)
            non_headings.append(indent)

    if non_headings:
        min_indent = min(non_headings)
        if min_indent > 0:
            result = [line[min_indent:] if line.startswith(' ' * min_indent) else line
                      for line in result]

    return '\n'.join(result)


def remove_video_width(html):
    """Remove hardcoded width from video tags, let CSS control sizing."""
    return re.sub(r'<video\s+([^>]*?)width="[^"]*"\s*([^>]*)>', r'<video \1\2>', html)

def build_page(h1, h2, tree, base_path, static_map):
    """Build a section page (either H1 overview or H2 detail)."""
    if h2:
        heading = h2
        content_md = strip_heading_line(h2['content_md'], 2)
        sub_pages = None
    else:
        heading = h1
        content_md = strip_heading_line(h1['intro_md'], 1)
        sub_pages = h1['children'] if h1['children'] else None

    if not content_md.strip():
        content_md = '暂无内容。'

    content_html = md_to_html(content_md)
    content_html = content_html.replace('src="static/', f'src="{base_path}static/')
    content_html = content_html.replace('src="videos/', f'src="{base_path}videos/')
    content_html = fix_image_extensions(content_html, static_map)
    content_html = remove_video_width(content_html)

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
    # Load markdown and normalize tabs to spaces upfront
    with open(MD_FILE, 'r', encoding='utf-8') as f:
        md_text = f.read()
    md_text = tab_to_spaces(md_text)
    md_text = escape_repetition_marks(md_text)

    overview, tree = split_sections(md_text)
    static_map = build_static_map(STATIC_DIR)

    overview_html = md_to_html(overview)
    # Remove the first H1 heading from overview — the hero section handles the title
    overview_html = re.sub(r'<h1>.*?</h1>\s*', '', overview_html, count=1)
    overview_html = overview_html.replace('src="static/', 'src="./static/')
    overview_html = overview_html.replace('src="videos/', 'src="./videos/')
    overview_html = fix_image_extensions(overview_html, static_map)
    overview_html = remove_video_width(overview_html)

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
        ctx = build_page(h1, None, tree, '../', static_map)
        ctx['base_path'] = '../'  # In subfolder, go up one level
        html = tpl_section.render(**ctx)
        with open(os.path.join(h1_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)

        # H2 detail pages
        for h2 in h1['children']:
            ctx = build_page(h1, h2, tree, '../../', static_map)
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
