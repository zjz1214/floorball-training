"""Regenerate markdown from feishu JSON dump, supporting videos."""
import json, os

with open('feishu-export/ISDBdRNj4oIqsxxqXtdcyyuJnoe.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

blocks_map = {b['block_id']: b for b in data['blocks']}
document_id = data['document']['document_id']

TEXT_KEYS = {
    2: 'text', 13: 'ordered', 12: 'bullet',
    3: 'heading1', 4: 'heading2', 5: 'heading3', 6: 'heading4',
    7: 'heading5', 8: 'heading6', 9: 'heading7', 10: 'heading8', 11: 'heading9',
}
HEADING_PREFIX = {3: '#', 4: '##', 5: '###', 6: '####', 7: '#####', 8: '######', 9: '#######', 10: '########', 11: '########'}

output_lines = []

def get_inline_content(b):
    """Extract inline content from a text/ordered/bullet block."""
    key = TEXT_KEYS.get(b.get('block_type', 0))
    if not key or key not in b:
        return ''

    parts = []
    for e in b[key].get('elements', []):
        if 'text_run' in e:
            tr = e['text_run']
            content = tr.get('content', '')
            style = tr.get('text_element_style', {})
            if style.get('inline_code'):
                content = f'`{content}`'
            elif style.get('bold'):
                content = f'**{content}**'
            elif style.get('italic'):
                content = f'_{content}_'
            elif style.get('strikethrough'):
                content = f'~~{content}~~'
            elif style.get('underline'):
                content = f'<u>{content}</u>'
            if style.get('link'):
                content = f'[{content}]({style["link"]})'
            parts.append(content)
        elif 'mention_user' in e:
            parts.append(f'@{e["mention_user"].get("name", "user")}')
        elif 'mention_doc' in e:
            parts.append(f'[doc]({e["mention_doc"].get("token", "")})')
        elif 'equation' in e:
            parts.append(f'${e["equation"].get("content", "")}$')
        elif 'inline_file' in e:
            # Inline image
            pass  # Will be handled separately
    return ''.join(parts)

def process_block(block_id, indent=0, ordered_start=None):
    """Process a block and return nothing (appends to output_lines)."""
    if block_id not in blocks_map:
        return
    b = blocks_map[block_id]
    bt = b.get('block_type', 0)
    children = b.get('children', [])
    prefix = '\t' * indent

    # ---- Text block ----
    if bt == 2:
        # Check for inline images
        text_key = 'text'
        if text_key in b:
            has_img = False
            for e in b[text_key].get('elements', []):
                if 'inline_file' in e:
                    token = e['inline_file']['file_token']
                    alt = e['inline_file'].get('name', token)
                    output_lines.append(f'{prefix}![]({alt})')
                    has_img = True
            if not has_img or True:
                content = get_inline_content(b)
                if content.strip():
                    output_lines.append(f'{prefix}{content}')
        for child_id in children:
            process_block(child_id, indent)

    # ---- Ordered list ----
    elif bt == 13:
        content = get_inline_content(b)
        # Calculate order number from parent's children
        parent = blocks_map.get(b.get('parent_id', ''), {})
        siblings = parent.get('children', [])
        order_num = siblings.index(block_id) + 1 if block_id in siblings else 1
        # Recalculate: only count type 13 siblings
        order_num = sum(1 for sid in siblings[:siblings.index(block_id)]
                       if blocks_map.get(sid, {}).get('block_type') == 13) + 1
        output_lines.append(f'{prefix}{order_num}. {content}')
        for child_id in children:
            process_block(child_id, indent + 1)

    # ---- Bullet list ----
    elif bt == 12:
        content = get_inline_content(b)
        output_lines.append(f'{prefix}- {content}')
        for child_id in children:
            process_block(child_id, indent + 1)

    # ---- Headings ----
    elif bt in (3, 4, 5, 6, 7, 8, 9, 10, 11):
        content = get_inline_content(b)
        h_prefix = HEADING_PREFIX[bt]
        output_lines.append(f'{prefix}{h_prefix} {content}')
        for child_id in children:
            process_block(child_id, indent)

    # ---- Divider ----
    elif bt == 22:
        output_lines.append(f'{prefix}---')

    # ---- Image ----
    elif bt == 27:
        if 'image' in b:
            token = b['image'].get('token', '')
            name = b['image'].get('name', token)
            output_lines.append(f'{prefix}![{name}](static/{name})')

    # ---- File/Video ----
    elif bt == 23:
        if 'file' in b:
            fname = b['file']['name'].replace('/', '_')
            output_lines.append(f'{prefix}<video src="videos/{fname}" controls width="640"></video>')

    # ---- Callout/Tip ----
    elif bt == 19:
        output_lines.append(f'{prefix}> [!TIP]')
        for child_id in children:
            process_block(child_id, indent)

    # ---- Code ----
    elif bt == 21:
        lang = ''
        content = ''
        if 'code' in b:
            lang = b['code'].get('language', '')
            content = '\n'.join(e.get('text_run', {}).get('content', '')
                               for e in b['code'].get('elements', []))
        output_lines.append(f'{prefix}```{lang}')
        output_lines.append(f'{prefix}{content}')
        output_lines.append(f'{prefix}```')

    # ---- Quote ----
    elif bt == 15:
        content = get_inline_content(b)
        output_lines.append(f'{prefix}> {content}')

    # ---- Quote Container ----
    elif bt == 34:
        for child_id in children:
            cb = blocks_map.get(child_id, {})
            c_text = get_inline_content(cb)
            output_lines.append(f'{prefix}> {c_text}')

    # ---- Grid ----
    elif bt == 24:
        for child_id in children:
            process_block(child_id, indent)

    # ---- Grid Column ----
    elif bt == 25:
        for child_id in children:
            process_block(child_id, indent)

    # ---- Table ----
    elif bt == 30:
        if 'sheet' in b:
            sheet = b['sheet']
            rows = sheet.get('rows', [])
            if rows:
                output_lines.append(f'{prefix}<table>')
                for row in rows:
                    cells = []
                    for cell in row.get('cells', []):
                        cell_text = []
                        for cid in cell.get('children', []):
                            cb = blocks_map.get(cid, {})
                            ct = get_inline_content(cb)
                            if ct:
                                cell_text.append(ct)
                        cells.append('<br/>'.join(cell_text))
                    output_lines.append(f'{prefix}<tr><td>' + '</td><td>'.join(cells) + '</td></tr>')
                output_lines.append(f'{prefix}</table>')

    # ---- View container (wraps videos/images in lists) ----
    elif bt == 33:
        for child_id in children:
            process_block(child_id, indent)

    # ---- Page (root) ----
    elif bt == 1:
        title = data['document'].get('title', '')
        output_lines.append(f'# {title}')
        output_lines.append('')
        for child_id in children:
            process_block(child_id, 0)

    # ---- Default: text-like content ----
    else:
        content = get_inline_content(b)
        if content.strip():
            output_lines.append(f'{prefix}{content}')
        for child_id in children:
            process_block(child_id, indent)

# Start processing from root
process_block(document_id)

# Write output
output = '\n'.join(output_lines)
with open('feishu-export/ISDBdRNj4oIqsxxqXtdcyyuJnoe.md', 'w', encoding='utf-8') as f:
    f.write(output)

print(f'Generated {len(output_lines)} lines, {len(output)} bytes')
