import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import LinkedBookClubBanner from '../LinkedBookClubBanner';
import { renderWithProviders } from '../../test/formTestUtils';
import i18n from '../../i18n';

describe('LinkedBookClubBanner', () => {
  it('renders nothing when there are no linked clubs', () => {
    const { container } = renderWithProviders(<LinkedBookClubBanner clubs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows discovery copy and links to the club hub and forum (Spanish)', async () => {
    await i18n.changeLanguage('es');
    renderWithProviders(
      <LinkedBookClubBanner
        clubs={[
          {
            id: 1,
            slug: 'el-secuestro-de-bitcoin',
            title: 'El Secuestro de Bitcoin',
            status: 'active',
            is_member: false,
          },
        ]}
      />
    );

    expect(
      screen.getByText(
        /este camino de conocimiento tiene un club de lectura vinculado/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText('El Secuestro de Bitcoin')).toBeInTheDocument();

    const clubLink = screen.getByRole('link', { name: /visitar el club de lectura/i });
    expect(clubLink).toHaveAttribute(
      'href',
      '/club-de-lectura/el-secuestro-de-bitcoin'
    );

    const forumLink = screen.getByRole('link', { name: /abrir el foro/i });
    expect(forumLink).toHaveAttribute(
      'href',
      '/club-de-lectura/el-secuestro-de-bitcoin/foro'
    );
  });

  it('shows discovery copy in English', async () => {
    await i18n.changeLanguage('en');
    renderWithProviders(
      <LinkedBookClubBanner
        clubs={[
          {
            id: 1,
            slug: 'el-secuestro-de-bitcoin',
            title: 'El Secuestro de Bitcoin',
            status: 'active',
            is_member: true,
          },
        ]}
      />
    );

    expect(
      screen.getByText(/this knowledge path has a reading club linked/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /visit the reading club/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open the forum/i })
    ).toBeInTheDocument();

    await i18n.changeLanguage('es');
  });
});
