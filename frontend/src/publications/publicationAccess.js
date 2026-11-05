/**
 * True only when the signed-in user is the publication author.
 * Missing ids fail closed so an incomplete payload cannot unlock editing.
 */
export function isPublicationAuthor(publication, user) {
  const authorId = publication?.user_id;
  const viewerId = user?.id;
  if (authorId == null || viewerId == null) {
    return false;
  }
  return Number(authorId) === Number(viewerId);
}
