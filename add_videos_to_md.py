"""Add video references to feishu2md generated markdown."""
import json, os

# Load JSON and build block map
with open('ISDBdRNj4oIqsxxqXtdcyyuJnoe.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

blocks_map = {}
for b in data['blocks']:
    blocks_map[b['block_id']] = b

TEXT_KEYS = ('text', 'ordered', 'heading1', 'heading2', 'heading3', 'heading4',
             'heading5', 'heading6', 'heading7', 'heading8', 'heading9', 'bullet')

def get_text(b):
    if not b:
        return ''
    for key in TEXT_KEYS:
        if key in b:
            content = ' '.join(e.get('text_run', {}).get('content', '')
                               for e in b[key].get('elements', []))
            return content
    return ''

def collect_video_order(root_id):
    """Walk the tree DFS (matching feishu2md order) and collect videos with context.
    Returns list of (video_filename, preceding_text, next_text)."""
    result = []
    visited = set()

    def walk(block_id, indent=0):
        if block_id in visited:
            return
        visited.add(block_id)
        b = blocks_map.get(block_id)
        if not b:
            return

        bt = b.get('block_type', 0)

        if bt == 23 and 'file' in b:
            # This is a video - it will be skipped by feishu2md (default case)
            # Its parent's walk has already been initiated, so we need to find
            # the nearest text in the parent's walk order
            result.append(b['file']['name'])
            return

        # Recurse into children for container types (same as feishu2md)
        container_types = {1, 3, 4, 5, 6, 7, 8, 9, 10, 11,  # headings
                          12, 13, 19, 24, 25, 30, 33, 34}  # bullet, ordered, callout, grid, table, view, quote
        if bt in container_types or True:  # Always check children
            for child_id in b.get('children', []):
                walk(child_id, indent + (1 if bt in {12, 13} else 0))

        # For type 33 (view containers), they wrap videos inside lists
        # feishu2md skips them (default) so their video children are lost

    root = blocks_map.get(root_id)
    if root:
        for child_id in root.get('children', []):
            walk(child_id)

    return result

document_id = data['document']['document_id']
video_names_in_order = collect_video_order(document_id)

print(f"Found {len(video_names_in_order)} videos in walk order:")
for i, name in enumerate(video_names_in_order):
    print(f"  {i+1}. {name}")

# Now the challenge: each video occupies a specific position in the tree walk.
# We need to insert it into the markdown at the corresponding position.
# Strategy: regenerate the markdown from the JSON, including videos.

# Let's instead regenerate the complete markdown.
