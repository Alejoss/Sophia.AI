import hashlib
import re
import unicodedata

from django.core.exceptions import ValidationError

TIMESTAMP_LINE = re.compile(
    r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})'
)
VTT_TAG = re.compile(r'<[^>]+>')
OBSIDIAN_FRONTMATTER = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)


def timestamp_to_ms(hours, minutes, seconds, millis):
    return (
        int(hours) * 3_600_000
        + int(minutes) * 60_000
        + int(seconds) * 1_000
        + int(millis)
    )


def parse_timestamp_line(line):
    match = TIMESTAMP_LINE.search(line)
    if not match:
        return None, None
    parts = [int(value) for value in match.groups()]
    start_ms = timestamp_to_ms(*parts[:4])
    end_ms = timestamp_to_ms(*parts[4:])
    return start_ms, end_ms


def strip_subtitle_markup(text):
    without_tags = VTT_TAG.sub('', text or '')
    return ' '.join(without_tags.split())


def parse_srt(source):
    normalized = source.replace('\r\n', '\n').replace('\r', '\n').strip()
    if not normalized:
        return []

    segments = []
    blocks = re.split(r'\n\s*\n', normalized)
    for block in blocks:
        lines = [line.strip() for line in block.split('\n') if line.strip()]
        if len(lines) < 2:
            continue

        timestamp_index = next(
            (idx for idx, line in enumerate(lines) if '-->' in line),
            None,
        )
        if timestamp_index is None:
            continue

        start_ms, end_ms = parse_timestamp_line(lines[timestamp_index])
        if start_ms is None or end_ms is None:
            continue

        text = strip_subtitle_markup('\n'.join(lines[timestamp_index + 1:]))
        if not text:
            continue

        segments.append({
            'index': len(segments) + 1,
            'start_ms': start_ms,
            'end_ms': end_ms,
            'text': text,
        })

    return segments


def parse_vtt(source):
    normalized = source.replace('\r\n', '\n').replace('\r', '\n').strip()
    if not normalized:
        return []

    lines = normalized.split('\n')
    blocks = []
    current = []

    for line in lines:
        stripped = line.strip()
        if stripped.upper().startswith('WEBVTT'):
            continue
        if stripped.startswith('NOTE') or stripped.startswith('STYLE') or stripped.startswith('REGION'):
            current = []
            continue
        if not stripped:
            if current:
                blocks.append(current)
                current = []
            continue
        current.append(stripped)

    if current:
        blocks.append(current)

    segments = []
    for block in blocks:
        timestamp_index = next(
            (idx for idx, line in enumerate(block) if '-->' in line),
            None,
        )
        if timestamp_index is None:
            continue

        start_ms, end_ms = parse_timestamp_line(block[timestamp_index])
        if start_ms is None or end_ms is None:
            continue

        text = strip_subtitle_markup('\n'.join(block[timestamp_index + 1:]))
        if not text:
            continue

        segments.append({
            'index': len(segments) + 1,
            'start_ms': start_ms,
            'end_ms': end_ms,
            'text': text,
        })

    return segments


def segments_to_plain_text(segments):
    return '\n'.join(segment['text'] for segment in segments if segment.get('text'))


def normalize_plain_text_for_hash(plain_text):
    normalized = unicodedata.normalize('NFC', plain_text or '')
    return ' '.join(normalized.split())


def compute_text_hash(plain_text):
    normalized = normalize_plain_text_for_hash(plain_text)
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def parse_subtitles(source_subtitles, subtitle_format):
    if subtitle_format == 'VTT':
        return parse_vtt(source_subtitles)
    return parse_srt(source_subtitles)


def parse_simple_yaml_frontmatter(yaml_text):
    data = {}
    for line in (yaml_text or '').splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or ':' not in stripped:
            continue
        key, _, value = stripped.partition(':')
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def extract_obsidian_body(markdown):
    text = markdown or ''
    match = OBSIDIAN_FRONTMATTER.match(text)
    if match:
        return text[match.end():].strip()
    return text.strip()


def extract_obsidian_frontmatter(markdown):
    text = markdown or ''
    match = OBSIDIAN_FRONTMATTER.match(text)
    if not match:
        return {}
    return parse_simple_yaml_frontmatter(match.group(1))


def normalize_language_code(raw_value):
    value = (raw_value or '').strip()
    if not value:
        return ''
    return value.split('-')[0].lower()


def resolve_hash_source_text(transcript):
    """Semantic text for hash/search: processed → parsed → Obsidian body."""
    processed = (transcript.processed_plain or '').strip()
    if processed:
        return processed

    parsed = (transcript.parsed_plain or '').strip()
    if parsed:
        return parsed

    return extract_obsidian_body(transcript.obsidian_markdown)


def sync_transcript_derived_fields(transcript):
    """
    Populate segments (optional SRT/VTT), obsidian_frontmatter, text_length and text_hash.

    Worker artifacts:
    - parsed_plain: post-SRT continuous text
    - processed_plain: spaCy-cleaned text (primary for hash / future RAG)
    - obsidian_markdown: YAML frontmatter + processed body
    """
    has_artifact = any(
        (getattr(transcript, field) or '').strip()
        for field in ('parsed_plain', 'processed_plain', 'obsidian_markdown')
    )
    if not has_artifact:
        raise ValidationError({
            'parsed_plain': (
                'Debe enviar al menos uno de: parsed_plain, processed_plain, obsidian_markdown.'
            ),
        })

    source = (transcript.source_subtitles or '').strip()
    if source:
        segments = parse_subtitles(source, transcript.format)
        if not segments:
            raise ValidationError({
                'source_subtitles': 'No se pudieron parsear subtítulos válidos en el formato indicado.',
            })
        transcript.segments = segments
    else:
        transcript.segments = []

    if transcript.obsidian_markdown:
        transcript.obsidian_frontmatter = extract_obsidian_frontmatter(
            transcript.obsidian_markdown
        )
    else:
        transcript.obsidian_frontmatter = {}

    if not (transcript.language or '').strip():
        language_code = transcript.obsidian_frontmatter.get('language_code', '')
        transcript.language = normalize_language_code(language_code)

    hash_source = resolve_hash_source_text(transcript)
    normalized = normalize_plain_text_for_hash(hash_source)
    transcript.text_length = len(normalized) if normalized else None
    transcript.text_hash = compute_text_hash(hash_source)
