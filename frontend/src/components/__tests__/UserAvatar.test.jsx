import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UserAvatar, { DEFAULT_AVATAR_SRC, getAvatarInitial } from '../UserAvatar';

describe('UserAvatar', () => {
  it('uses the default avatar when no profile picture is provided', () => {
    render(<UserAvatar username="h4stur" size={48} />);
    const image = screen.getByRole('img', { name: 'Avatar de h4stur' });
    expect(image).toHaveAttribute('src', DEFAULT_AVATAR_SRC);
  });

  it('uses a custom profile picture when provided', () => {
    render(
      <UserAvatar
        username="h4stur"
        src="https://example.com/avatar.jpg"
        size={48}
      />
    );
    const image = screen.getByRole('img', { name: 'Avatar de h4stur' });
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });
});

describe('getAvatarInitial', () => {
  it('returns the first letter uppercased', () => {
    expect(getAvatarInitial('h4stur')).toBe('H');
  });

  it('returns ? for empty usernames', () => {
    expect(getAvatarInitial('')).toBe('?');
  });
});
