import { describe, it, expect } from 'vitest';
import { getTopicChatSourcePath, getTopicContentPath } from '../urlUtils';

describe('getTopicChatSourcePath', () => {
  it('uses backend source_url when present', () => {
    expect(
      getTopicChatSourcePath(
        { source_url: '/content/2/topic/2', content_id: 2, media_type: 'TEXT' },
        2,
      ),
    ).toBe('/content/2/topic/2');
  });

  it('links text files to the topic content view', () => {
    expect(
      getTopicChatSourcePath(
        { content_id: 2, media_type: 'TEXT', has_transcript: false, title: 'El Secuestro de Bitcoin' },
        2,
      ),
    ).toBe(getTopicContentPath(2, 2));
  });

  it('links video transcripts when a transcript exists', () => {
    expect(
      getTopicChatSourcePath(
        { content_id: 46, media_type: 'VIDEO', has_transcript: true },
        2,
      ),
    ).toBe('/content/46/transcript?context=topic&topicId=2');
  });

  it('does not send legacy text citations to the empty transcript page', () => {
    expect(
      getTopicChatSourcePath(
        {
          content_id: 2,
          title: 'El Secuestro de Bitcoin',
          transcript_url: '/content/2/transcript?context=topic',
        },
        2,
      ),
    ).toBe('/content/2/topic/2');
  });
});
