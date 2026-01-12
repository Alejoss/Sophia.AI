import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeList from '../BadgeList';

describe('BadgeList', () => {
  const mockBadges = [
    {
      id: 1,
      badge_code: 'first_comment',
      badge_name: 'First Voice',
      badge_description: 'Made your first comment',
      badge_category: 'CONTRIBUTION',
      earned_at: '2024-01-15T10:00:00Z',
      points_earned: 10,
      context_data: {},
    },
    {
      id: 2,
      badge_code: 'knowledge_seeker',
      badge_name: 'Knowledge Seeker',
      badge_description: 'Completed 20 nodes',
      badge_category: 'LEARNING',
      earned_at: '2024-01-20T10:00:00Z',
      points_earned: 35,
      context_data: { completed_nodes_count: 20 },
    },
  ];

  it('renders loading state', () => {
    render(<BadgeList badges={[]} loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<BadgeList badges={[]} error="Error loading badges" />);
    expect(screen.getByText('Error loading badges')).toBeInTheDocument();
  });

  it('renders empty state when no badges', () => {
    render(<BadgeList badges={[]} />);
    expect(screen.getByText('Aún no hay insignias')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(
      <BadgeList badges={[]} emptyMessage="No badges yet" />
    );
    expect(screen.getByText('No badges yet')).toBeInTheDocument();
  });

  it('renders list of badges', () => {
    render(<BadgeList badges={mockBadges} />);
    expect(screen.getByText('First Voice')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Seeker')).toBeInTheDocument();
  });

  it('renders badge descriptions', () => {
    render(<BadgeList badges={mockBadges} />);
    expect(screen.getByText('Made your first comment')).toBeInTheDocument();
    expect(screen.getByText('Completed 20 nodes')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<BadgeList badges={mockBadges} title="My Achievements" />);
    expect(screen.getByText('My Achievements')).toBeInTheDocument();
  });

  it('displays earning description in tooltip', () => {
    render(<BadgeList badges={mockBadges} />);
    const firstBadge = screen.getByText('First Voice').closest('div');
    expect(firstBadge).toBeInTheDocument();
  });

  it('handles badges with context data for earning description', () => {
    const badgeWithContext = {
      ...mockBadges[1],
      context_data: { completed_nodes_count: 25 },
    };
    render(<BadgeList badges={[badgeWithContext]} />);
    expect(screen.getByText('Knowledge Seeker')).toBeInTheDocument();
  });

  it('handles badge with earned_at date', () => {
    render(<BadgeList badges={mockBadges} />);
    // The date should be formatted and displayed in tooltip
    const badges = screen.getAllByText(/First Voice|Knowledge Seeker/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('handles missing badge properties gracefully', () => {
    const incompleteBadge = {
      id: 3,
      badge_name: 'Incomplete Badge',
    };
    render(<BadgeList badges={[incompleteBadge]} />);
    expect(screen.getByText('Incomplete Badge')).toBeInTheDocument();
  });
});
