import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PitchText } from '../pitchText';

describe('PitchText', () => {
  it('renders bold markdown and keeps line breaks', () => {
    render(
      <PitchText text={'**Learn to Learn** is an investigation.\nIt continues here.\n\nA second paragraph.'} />,
    );
    const title = screen.getByText('Learn to Learn');
    expect(title.tagName).toBe('STRONG');
    expect(screen.getByText(/is an investigation/)).toBeInTheDocument();
    expect(screen.getByText('It continues here.')).toBeInTheDocument();
    expect(screen.getByText('A second paragraph.')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });
});
