import { isOwnedByUser } from '../utils/ownership';

/**
 * True only when the signed-in user is the publication author.
 * Missing ids fail closed so an incomplete payload cannot unlock editing.
 */
export function isPublicationAuthor(publication, user) {
  return isOwnedByUser(publication?.user_id, user);
}
