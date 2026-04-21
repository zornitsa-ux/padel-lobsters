// =============================================================================
//  DEPRECATED — delete this file.
//
//  An earlier draft of Phase 3 routed new-member signups through an admin
//  approval queue. The final design is self-serve: the PIN prompt has a
//  "Sign up" option that creates the player immediately and signs them in.
//  No approval step, no admin inbox, no `signup_requests` table.
//
//  Safe to `git rm` this file — it isn't imported anywhere in the tree.
// =============================================================================

export default function AdminSignupRequests_Deprecated() {
  return null
}
