/**
 * True when ownerId is the signed-in user.
 * Missing ids fail closed so an incomplete payload cannot unlock editing.
 */
export function isOwnedByUser(ownerId, user) {
  if (ownerId == null || user?.id == null) {
    return false;
  }
  return Number(ownerId) === Number(user.id);
}
