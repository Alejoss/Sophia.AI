import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentDisplay from '../ContentDisplay';
import { AuthContext } from '../../context/AuthContext';
import { mockAuthValue, unauthenticatedAuth } from '../../test/formTestUtils';

const renderContentDisplay = (content, { auth = mockAuthValue } = {}) =>
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ContentDisplay content={content} variant="detailed" showAuthor={false} />
      </MemoryRouter>
    </AuthContext.Provider>,
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

  it('does not show the empty text preview box for file-based TEXT without thumbnail', () => {
    const content = {
      id: 12,
      media_type: 'TEXT',
      original_title: 'El Secuestro de Bitcoin',
      file_details: {
        file: '/media/docs/bitcoin.pdf',
        url: '/media/docs/bitcoin.pdf',
        file_size: 1260000,
      },
    };

    renderContentDisplay(content);

    expect(screen.queryByText(/no hay contenido de texto disponible/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar archivo/i })).toBeInTheDocument();
  });

  it('shows the custom thumbnail for TEXT content when available', () => {
    const content = {
      id: 13,
      media_type: 'TEXT',
      original_title: 'Libro con portada',
      selected_profile: {
        title: 'Libro con portada',
        thumbnail: 'https://cdn.example.com/cover.jpg',
        thumbnail_preview: 'https://cdn.example.com/cover-preview.webp',
      },
      file_details: {
        file: '/media/docs/libro.pdf',
        url: '/media/docs/libro.pdf',
        file_size: 2048,
      },
    };

    renderContentDisplay(content);

    const img = screen.getByAltText('Content thumbnail');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/cover-preview.webp');
    expect(screen.queryByText(/no hay contenido de texto disponible/i)).not.toBeInTheDocument();
  });

  it('asks guests to log in instead of downloading the file', () => {
    const content = {
      id: 14,
      media_type: 'TEXT',
      original_title: 'Documento protegido',
      has_file_available: true,
      file_details: {
        file: '/media/docs/secreto.pdf',
        url: '/media/docs/secreto.pdf',
        file_size: 2048,
      },
    };

    renderContentDisplay(content, { auth: unauthenticatedAuth() });

    expect(
      screen.getByRole('link', { name: /inicia sesión para descargar/i }),
    ).toHaveAttribute('href', '/profiles/login?next=%2F');
    expect(screen.queryByRole('button', { name: /descargar archivo/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/documento protegido/i));
    expect(openSpy).not.toHaveBeenCalled();
  });
});
