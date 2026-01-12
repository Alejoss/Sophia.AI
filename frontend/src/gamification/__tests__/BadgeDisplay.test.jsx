import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeDisplay from '../BadgeDisplay';

describe('BadgeDisplay', () => {
  const mockBadge = {
    id: 1,
    badge_code: 'first_comment',
    badge_name: 'First Voice',
    badge_description: 'Made your first comment',
    badge_category: 'CONTRIBUTION',
    badge_icon: null,
  };

  it('renders badge with correct name', () => {
    render(<BadgeDisplay badge={mockBadge} showName={true} />);
    expect(screen.getByText('First Voice')).toBeInTheDocument();
  });

  it('does not render badge name when showName is false', () => {
    render(<BadgeDisplay badge={mockBadge} showName={false} />);
    expect(screen.queryByText('First Voice')).not.toBeInTheDocument();
  });

  it('renders badge icon with correct alt text', () => {
    render(<BadgeDisplay badge={mockBadge} />);
    const img = screen.getByAltText('First Voice');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('uses mapped icon when database icon is not available', () => {
    render(<BadgeDisplay badge={mockBadge} />);
    const img = screen.getByAltText('First Voice');
    // Should use mapped icon path for first_comment
    expect(img.src).toContain('badge_sky_blue.png');
  });

  it('uses database icon when available', () => {
    const badgeWithIcon = {
      ...mockBadge,
      badge_icon: 'http://example.com/custom-icon.png',
    };
    render(<BadgeDisplay badge={badgeWithIcon} />);
    const img = screen.getByAltText('First Voice');
    expect(img.src).toContain('custom-icon.png');
  });

  it('falls back to default icon on image error', () => {
    render(<BadgeDisplay badge={mockBadge} />);
    const img = screen.getByAltText('First Voice');
    
    // Simulate image error
    const errorEvent = new Event('error');
    img.dispatchEvent(errorEvent);
    
    // After error, should fallback to default
    expect(img.src).toContain('badge_sky_blue.png');
  });

  it('applies correct size based on context', () => {
    const { container } = render(
      <BadgeDisplay badge={mockBadge} context="comment" />
    );
    const badgeIcon = container.querySelector('img').parentElement;
    expect(badgeIcon).toHaveStyle({ width: '18px', height: '18px' });
  });

  it('applies correct size based on explicit size prop', () => {
    const { container } = render(
      <BadgeDisplay badge={mockBadge} size="large" />
    );
    const badgeIcon = container.querySelector('img').parentElement;
    expect(badgeIcon).toHaveStyle({ width: '80px', height: '80px' });
  });

  it('handles badge with code property instead of badge_code', () => {
    const badgeWithCode = {
      ...mockBadge,
      code: 'first_comment',
      name: 'First Voice',
    };
    delete badgeWithCode.badge_code;
    delete badgeWithCode.badge_name;
    
    render(<BadgeDisplay badge={badgeWithCode} showName={true} />);
    expect(screen.getByText('First Voice')).toBeInTheDocument();
  });

  it('handles missing badge data gracefully', () => {
    const incompleteBadge = {
      badge_name: 'Test Badge',
    };
    render(<BadgeDisplay badge={incompleteBadge} />);
    const img = screen.getByAltText('Test Badge');
    expect(img).toBeInTheDocument();
  });
});
