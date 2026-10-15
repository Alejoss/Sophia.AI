import hashlib
import logging
import re
import unicodedata

from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

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
    """Apply the existing Bitcoin transcript convention: NFC, then whitespace collapse.

    Planned IPFS archives must store the resulting exact UTF-8 text so the same
    SHA-256 verifies on both chains. This normalization is transcript-specific;
    do not apply it to knowledge-path JSON, which needs a separate
    canonicalization rule.
    """
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


def resolve_certified_plain_text(transcript):
    """
    Exact UTF-8 string whose SHA-256 is ``transcript.text_hash``.

    Applies the same NFC + whitespace normalization used by ``compute_text_hash``.
    Prefer this for public display / copy / verification so
    ``sha256(utf8(text)) == text_hash`` without client-side re-normalization.

    When ``text_hash_locked`` and ``hash_plain_text`` are set (external Vincent
    ingest), return that snapshot as-is — it is already normalized and may keep
    Spanish accents that SQL_ASCII ``prepare_text_for_db`` stripped elsewhere.
    """
    if getattr(transcript, 'text_hash_locked', False):
        locked_plain = (getattr(transcript, 'hash_plain_text', None) or '').strip()
        if locked_plain:
            return locked_plain
    return normalize_plain_text_for_hash(resolve_hash_source_text(transcript))


def resolve_public_transcript_text(transcript):
    """
    Text shown on public transcript pages.

    Prefer a snapshotted ``TranscriptAnchor.certified_plain_text`` when an
    anchor exists for the current ``text_hash`` (stable after re-ingest of
    non-matching drafts). Otherwise return the live certified plain text.
    """
    current_hash = (getattr(transcript, 'text_hash', None) or '').strip()
    if current_hash:
        # Local import avoids circular import with models → transcript_utils.
        from content.models import TranscriptAnchor

        content_id = getattr(transcript, 'content_id', None)
        if content_id:
            certified = (
                TranscriptAnchor.objects.filter(
                    content_id=content_id,
                    text_hash=current_hash,
                )
                .exclude(certified_plain_text='')
                .values_list('certified_plain_text', flat=True)
                .first()
            )
            if certified:
                return certified
    return resolve_certified_plain_text(transcript)


def plain_text_matching_hash(plain_text, expected_hash):
    """
    Return the exact UTF-8 string whose SHA-256 is ``expected_hash``.

    Tries the given bytes first, then the NFC + collapsed-whitespace form used
    for transcript anchors. Returns None when neither matches.
    """
    expected = (expected_hash or '').strip().lower()
    if len(expected) != 64 or not (plain_text or '').strip():
        return None
    raw = plain_text
    if hashlib.sha256(raw.encode('utf-8')).hexdigest() == expected:
        return raw
    normalized = normalize_plain_text_for_hash(raw)
    if (
        normalized
        and hashlib.sha256(normalized.encode('utf-8')).hexdigest() == expected
    ):
        return normalized
    return None


def backfill_anchor_certified_text(anchor, plain_text=None):
    """
    Store ``certified_plain_text`` on an older anchor that only kept the digest.

    Uses an explicit ``plain_text`` when given. Otherwise tries the transcript's
    locked hash snapshot and the live normalized text. Saves only when the
    bytes hash to ``anchor.text_hash``.

    Returns (anchor, restored). ``restored`` is True only when this call wrote
    the snapshot.
    """
    if (anchor.certified_plain_text or '').strip():
        return anchor, False

    candidates = []
    if plain_text is not None:
        candidates.append(plain_text)
    else:
        from content.models import ContentTranscript

        transcript = ContentTranscript.objects.filter(content_id=anchor.content_id).first()
        if transcript is not None:
            locked = (getattr(transcript, 'hash_plain_text', None) or '')
            if locked.strip():
                candidates.append(locked)
            live = resolve_certified_plain_text(transcript)
            if live and live not in candidates:
                candidates.append(live)

    for candidate in candidates:
        matched = plain_text_matching_hash(candidate, anchor.text_hash)
        if not matched:
            continue
        anchor.certified_plain_text = matched
        anchor.text_length = len(matched)
        anchor.save(update_fields=['certified_plain_text', 'text_length', 'updated_at'])
        logger.info(
            'Backfilled certified_plain_text anchor=%s content=%s text_hash=%s',
            anchor.pk,
            anchor.content_id,
            anchor.text_hash,
        )
        return anchor, True
    return anchor, False


def _normalized_text_hash(plain_text):
    normalized = normalize_plain_text_for_hash(plain_text)
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def anchor_certified_text_status(anchor, plain_text=None):
    """
    Report whether an anchor's Bitcoin digest can be recovered. Does not write.

    ``status`` is ``already_present``, ``restorable``, or ``unmatched``.
    ``computed_text_hash`` is the SHA-256 of the candidate that was tested
    (NFC + collapsed whitespace), or the stored snapshot when one exists.
    """
    from content.models import ContentTranscript

    transcript = ContentTranscript.objects.filter(content_id=anchor.content_id).first()
    current_hash = (transcript.text_hash or '') if transcript else ''
    row = {
        'anchor_id': anchor.pk,
        'content_id': anchor.content_id,
        'text_hash': anchor.text_hash,
        'text_length': anchor.text_length,
        'btc_txid': anchor.btc_txid or '',
        'btc_network': anchor.btc_network,
        'current_text_hash': current_hash or None,
        'matches_current_transcript': bool(current_hash) and current_hash == (anchor.text_hash or ''),
        'has_certified_plain_text': bool((anchor.certified_plain_text or '').strip()),
        'computed_text_hash': None,
        'source': None,
        'status': 'unmatched',
    }
    if row['has_certified_plain_text']:
        row['status'] = 'already_present'
        row['source'] = 'certified_plain_text'
        row['computed_text_hash'] = hashlib.sha256(
            anchor.certified_plain_text.encode('utf-8')
        ).hexdigest()
        return row

    if plain_text is not None:
        row['source'] = 'plain_text'
        row['computed_text_hash'] = _normalized_text_hash(plain_text)
        if plain_text_matching_hash(plain_text, anchor.text_hash):
            row['status'] = 'restorable'
        return row

    candidates = []
    if transcript is not None:
        locked = (getattr(transcript, 'hash_plain_text', None) or '')
        if locked.strip():
            candidates.append(('hash_plain_text', locked))
        live = resolve_certified_plain_text(transcript)
        if live and all(live != item[1] for item in candidates):
            candidates.append(('transcript', live))
    for source_name, candidate in candidates:
        if plain_text_matching_hash(candidate, anchor.text_hash):
            row['status'] = 'restorable'
            row['source'] = source_name
            row['computed_text_hash'] = anchor.text_hash
            return row
    if candidates:
        row['source'] = candidates[-1][0]
        row['computed_text_hash'] = _normalized_text_hash(candidates[-1][1])
    return row


def restore_missing_anchor_certified_texts(
    *,
    content_id=None,
    anchor_id=None,
    plain_text=None,
    dry_run=False,
):
    """
    Fill empty ``certified_plain_text`` snapshots whose bytes hash to the anchor.

    With no ``content_id``, ``anchor_id``, or ``plain_text``, only blank
    snapshots are scanned and the live transcript (or locked
    ``hash_plain_text``) is the candidate. A content or anchor id reports every
    anchor for that target. ``plain_text`` is checked against that target and
    stored only on a hash match.

    Returns a report. ``dry_run`` classifies rows as ``would_restore`` and
    does not write.
    """
    from content.models import TranscriptAnchor

    queryset = TranscriptAnchor.objects.all().order_by('id')
    if anchor_id is not None:
        queryset = queryset.filter(pk=anchor_id)
    if content_id is not None:
        queryset = queryset.filter(content_id=content_id)
    if plain_text is None and content_id is None and anchor_id is None:
        queryset = queryset.filter(certified_plain_text='')

    rows = []
    for anchor in queryset:
        status = anchor_certified_text_status(anchor, plain_text=plain_text)
        if status['status'] == 'restorable':
            if dry_run:
                status['status'] = 'would_restore'
            else:
                _anchor, wrote = backfill_anchor_certified_text(
                    anchor,
                    plain_text=plain_text,
                )
                status['status'] = 'restored' if wrote else 'already_present'
                status['has_certified_plain_text'] = bool(
                    (_anchor.certified_plain_text or '').strip()
                )
        rows.append(status)

    def _count(name):
        return sum(1 for row in rows if row['status'] == name)

    return {
        'dry_run': bool(dry_run),
        'checked': len(rows),
        'restored': _count('restored'),
        'would_restore': _count('would_restore'),
        'already_present': _count('already_present'),
        'unmatched': _count('unmatched'),
        'anchors': rows,
    }


def _bind_embedding_on_content(content, embedding):
    """Keep content.embedding from returning a stale in-memory reverse OneToOne."""
    cache = getattr(content._state, 'fields_cache', None)
    if isinstance(cache, dict):
        cache['embedding'] = embedding


def sync_embedding_status_for_text_hash(transcript):
    """
    Keep ContentEmbedding.status aligned with transcript.text_hash vs source_hash.

    Called on transcript save (including transcript-ingest PUT). Does not write
    vectors; only marks pending/stale so a later embed worker can pick work up.
    """
    from content.models import ContentEmbedding

    embedding, _ = ContentEmbedding.objects.get_or_create(
        content=transcript.content,
        defaults={'status': ContentEmbedding.STATUS_PENDING},
    )
    status = (embedding.status or '').strip() or ContentEmbedding.STATUS_PENDING
    if status == ContentEmbedding.STATUS_SKIPPED:
        _bind_embedding_on_content(transcript.content, embedding)
        return

    current_hash = (transcript.text_hash or '').strip()
    embedded_hash = (embedding.source_hash or '').strip()

    if not current_hash:
        new_status = ContentEmbedding.STATUS_PENDING
    elif embedded_hash and embedded_hash == current_hash:
        # Corpus unchanged since last successful index (or same hash after failed retry).
        _bind_embedding_on_content(transcript.content, embedding)
        return
    elif embedded_hash and embedded_hash != current_hash:
        new_status = ContentEmbedding.STATUS_STALE
    else:
        new_status = ContentEmbedding.STATUS_PENDING

    if embedding.status != new_status:
        embedding.status = new_status
        embedding.save(update_fields=['status', 'updated_at'])
    _bind_embedding_on_content(transcript.content, embedding)


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

    if (
        getattr(transcript, 'text_hash_locked', False)
        and (getattr(transcript, 'text_hash', None) or '').strip()
    ):
        locked_plain = (getattr(transcript, 'hash_plain_text', None) or '').strip()
        if locked_plain:
            transcript.text_length = len(locked_plain)
        else:
            normalized = normalize_plain_text_for_hash(resolve_hash_source_text(transcript))
            transcript.text_length = len(normalized) if normalized else None
        # Keep worker-supplied text_hash; do not recompute from (possibly
        # SQL_ASCII-degraded) stored artifacts.
    else:
        hash_source = resolve_hash_source_text(transcript)
        normalized = normalize_plain_text_for_hash(hash_source)
        transcript.text_length = len(normalized) if normalized else None
        transcript.text_hash = compute_text_hash(hash_source)
    sync_embedding_status_for_text_hash(transcript)
