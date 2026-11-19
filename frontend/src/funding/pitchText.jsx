import { Box } from '@mui/material';

const INLINE = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;

export function pitchBlocks(source) {
  const text = String(source || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    const items = lines.map((line) => line.trim()).filter(Boolean);
    if (items.length > 0 && items.every((line) => /^[-*]\s+\S/.test(line))) {
      return { type: 'list', items: items.map((line) => line.replace(/^[-*]\s+/, '')) };
    }
    return { type: 'paragraph', lines };
  });
}

function inlineParts(line) {
  const parts = [];
  const pattern = new RegExp(INLINE.source, 'g');
  let last = 0;
  let match = pattern.exec(line);
  while (match) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index) });
    if (match[1] != null || match[2] != null) parts.push({ bold: match[1] ?? match[2] });
    else parts.push({ em: match[3] ?? match[4] });
    last = match.index + match[0].length;
    match = pattern.exec(line);
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  if (parts.length === 0) parts.push({ text: line });
  return parts;
}

function Inline({ line }) {
  return inlineParts(line).map((part, index) => {
    if (part.bold) return <strong key={index}>{part.bold}</strong>;
    if (part.em) return <em key={index}>{part.em}</em>;
    return <span key={index}>{part.text}</span>;
  });
}

export function PitchText({ text }) {
  const blocks = pitchBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <Box
      className="funding-pitch"
      sx={{
        color: 'text.secondary',
        lineHeight: 1.75,
        '& p': { m: 0, mb: '0.9em' },
        '& p:last-child': { mb: 0 },
        '& ul': { m: 0, mb: '0.9em', pl: '1.25em' },
        '& li + li': { mt: '0.35em' },
      }}
    >
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}><Inline line={item} /></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${line}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                <Inline line={line} />
              </span>
            ))}
          </p>
        );
      })}
    </Box>
  );
}
