import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentDisplay from '../ContentDisplay';

const renderContentDisplay = (content) =>
  render(
    <MemoryRouter>
      <ContentDisplay content={content} variant="detailed" showAuthor={false} />
    </MemoryRouter>,
  );

describe('ContentDisplay', () => {
  let openSpy;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('does not open the file in a new tab when interacting with the detailed video player', () => {
    const content = {
      id: 10,
      media_type: 'VIDEO',
      original_title: 'Ucronia 03 - PCR',
      file_details: {
        file: '/media/videos/ucronia.mp4',
        url: '/media/videos/ucronia.mp4',
        file_size: 1024,
      },
    };

    const { container } = renderContentDisplay(content);

    fireEvent.click(container.querySelector('video'));

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('keeps the explicit download action available for detailed video content', () => {
    const content = {
      id: 10,
      media_type: 'VIDEO',
      original_title: 'Ucronia 03 - PCR',
      file_details: {
        file: '/media/videos/ucronia.mp4',
        url: '/media/videos/ucronia.mp4',
        file_size: 1024,
      },
    };

    renderContentDisplay(content);

    fireEvent.click(screen.getByRole('button', { name: /descargar archivo/i }));

    expect(openSpy).toHaveBeenCalledWith(
      'http://localhost:8000/media/videos/ucronia.mp4',
      '_blank',
    );
  });

  it('opens the file in a new tab when clicking the title in detailed view', () => {
    const content = {
      id: 11,
      media_type: 'TEXT',
      original_title: 'Documento importante',
      file_details: {
        file: '/media/docs/documento.pdf',
        url: '/media/docs/documento.pdf',
        file_size: 2048,
      },
    };

    renderContentDisplay(content);

    fireEvent.click(screen.getByRole('button', { name: /documento importante/i }));

    expect(openSpy).toHaveBeenCalledWith(
      'http://localhost:8000/media/docs/documento.pdf',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
