import { describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FundingGuide from '../FundingGuide';
import FundingList from '../FundingList';
import { renderWithProviders } from '../../test/formTestUtils';

vi.mock('../../api/pathFundingApi', () => ({
  default: {
    listProposals: vi.fn().mockResolvedValue([]),
    getBchUsdRate: vi.fn().mockResolvedValue({ usd_per_bch: '500' }),
  },
}));

describe('crowdfunding guide', () => {
  it('links the investigation list to the explanation', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/knowledge_path/funding" element={<FundingList />} />
        <Route path="/knowledge_path/funding/how" element={<FundingGuide />} />
      </Routes>,
      { route: '/knowledge_path/funding' },
    );
    const link = await screen.findByRole('link', {
      name: 'Cómo funcionan las investigaciones de financiamiento colectivo',
    });
    await userEvent.click(link);
    expect(await screen.findByRole('heading', { name: 'Cómo funciona un aporte' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cómo termina' })).toBeInTheDocument();
    expect(screen.getByText('Una persona')).toBeInTheDocument();
    expect(screen.getByText(/Cada aporte acerca la investigación a su meta/)).toBeInTheDocument();
    expect(screen.getByText(/Enviar Bitcoin Cash a una dirección no cuenta/)).toBeInTheDocument();
  });
});
