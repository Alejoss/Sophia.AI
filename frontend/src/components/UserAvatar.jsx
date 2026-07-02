import React, { useState } from 'react';
import { Avatar } from '@mui/material';

export const DEFAULT_AVATAR_SRC = '/images/default-avatar.svg';

export function getAvatarInitial(username) {
  const trimmed = (username || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

/**
 * Profile avatar with a bundled default image and initials fallback.
 */
const UserAvatar = ({
  src,
  username,
  alt,
  size,
  sx,
  imgProps,
  ...rest
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const hasCustomImage = Boolean(src) && !imageFailed;
  const resolvedSrc = hasCustomImage ? src : DEFAULT_AVATAR_SRC;
  const dimension = size ? { width: size, height: size } : {};

  return (
    <Avatar
      src={resolvedSrc}
      alt={alt || (username ? `Avatar de ${username}` : 'Avatar de usuario')}
      imgProps={{
        ...imgProps,
        onError: (event) => {
          imgProps?.onError?.(event);
          if (hasCustomImage) {
            setImageFailed(true);
          }
        },
      }}
      sx={{
        ...dimension,
        fontSize: size ? `${Math.round(size * 0.4)}px` : undefined,
        bgcolor: 'primary.light',
        color: 'primary.dark',
        ...sx,
      }}
      {...rest}
    >
      {getAvatarInitial(username)}
    </Avatar>
  );
};

export default UserAvatar;
