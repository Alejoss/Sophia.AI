import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBadges, useAllBadges } from '../useBadges';
import * as gamificationApi from '../../api/gamificationApi';

vi.mock('../../api/gamificationApi');

describe('useBadges', () => {
  const mockBadgesData = {
    badges: [
      {
        id: 1,
        badge_code: 'first_comment',
        badge_name: 'First Voice',
        badge_description: 'Made your first comment',
        earned_at: '2024-01-15T10:00:00Z',
        points_earned: 10,
      },
    ],
    total_points: 10,
    badge_count: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches own badges when userId is null', async () => {
    gamificationApi.getMyBadges.mockResolvedValue(mockBadgesData);

    const { result } = renderHook(() => useBadges(null));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(mockBadgesData.badges);
    expect(result.current.totalPoints).toBe(10);
    expect(result.current.badgeCount).toBe(1);
    expect(gamificationApi.getMyBadges).toHaveBeenCalledTimes(1);
  });

  it('fetches user badges when userId is provided', async () => {
    const userBadgesData = {
      results: mockBadgesData.badges,
    };
    gamificationApi.getUserBadges.mockResolvedValue(userBadgesData);

    const { result } = renderHook(() => useBadges(123));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(mockBadgesData.badges);
    expect(gamificationApi.getUserBadges).toHaveBeenCalledWith(123);
  });

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to fetch badges';
    gamificationApi.getMyBadges.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useBadges(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.badges).toEqual([]);
  });

  it('handles empty badges array', async () => {
    gamificationApi.getMyBadges.mockResolvedValue({
      badges: [],
      total_points: 0,
      badge_count: 0,
    });

    const { result } = renderHook(() => useBadges(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual([]);
    expect(result.current.totalPoints).toBe(0);
    expect(result.current.badgeCount).toBe(0);
  });

  it('provides refetch function', async () => {
    gamificationApi.getMyBadges.mockResolvedValue(mockBadgesData);

    const { result } = renderHook(() => useBadges(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(gamificationApi.getMyBadges).toHaveBeenCalledTimes(2);
    });
  });

  it('handles getUserBadges with array response', async () => {
    gamificationApi.getUserBadges.mockResolvedValue(mockBadgesData.badges);

    const { result } = renderHook(() => useBadges(123));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(mockBadgesData.badges);
  });
});

describe('useAllBadges', () => {
  const mockAllBadges = [
    {
      id: 1,
      code: 'first_comment',
      name: 'First Voice',
      description: 'Made your first comment',
      points_value: 10,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all badges', async () => {
    gamificationApi.getAllBadges.mockResolvedValue({
      results: mockAllBadges,
    });

    const { result } = renderHook(() => useAllBadges());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(mockAllBadges);
    expect(gamificationApi.getAllBadges).toHaveBeenCalledTimes(1);
  });

  it('handles array response format', async () => {
    gamificationApi.getAllBadges.mockResolvedValue(mockAllBadges);

    const { result } = renderHook(() => useAllBadges());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.badges).toEqual(mockAllBadges);
  });

  it('handles errors', async () => {
    const errorMessage = 'Failed to fetch all badges';
    gamificationApi.getAllBadges.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useAllBadges());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.badges).toEqual([]);
  });
});
