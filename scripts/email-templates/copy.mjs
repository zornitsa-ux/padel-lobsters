const SHARED = `  Shared shape (docs/pin-auth-removal DESIGN §2): the 6-digit code first,
  because a link tapped on iPhone opens Safari, not the home-screen app; then a
  token_hash link through the SPA's /auth/confirm route, never
  {{ .ConfirmationURL }} (see config.toml). magic_link, confirmation, recovery
  and reauthentication share this layout.

  Generated: edit scripts/email-templates/, then run \`npm run templates:build\`.`

const EMAIL_CHANGE_COMMENT = `  Email-change confirmation template.

  GoTrue sends this email to BOTH the current and new addresses (because
  auth.email.double_confirm_changes = true in config.toml). The new
  address gets it as the primary confirmation; the current address gets
  it as a security notification.

  In GoTrue v2.189, a single token-hash redemption applies the change —
  the first link clicked completes the switch and the other link
  becomes a no-op ("link expired"). We word the template accordingly:
  click any link to confirm, ignore if you didn't request the change.

  Like magic_link.html, we route through /auth/confirm rather than
  {{ .ConfirmationURL }} (which 404s through Kong locally).

  Generated: edit scripts/email-templates/, then run \`npm run templates:build\`.`

export const TEMPLATES = {
  magic_link: {
    comment: `  Sign-in email: sent by signInWithOtp for an existing user.

${SHARED}`,
    title: 'Sign in to Padel Lobsters',
    heading: 'Sign in to Padel Lobsters',
    intro: 'Type this code into the app when it asks for a sign-in code.',
    codeLabel: 'Your sign-in code',
    buttonIntro: 'Or sign in on this device with the button.',
    buttonLabel: 'Sign in',
    link: { type: 'magiclink', next: '/home' },
    wrapLinkText: true,
    footnote: `The code and link work once and expire in 1 hour.<br /><br />If you didn't ask to sign in, you can safely ignore this email.<br /><br />`,
  },
  confirmation: {
    comment: `  Sign-up email: sent instead of magic_link to a brand-new address while
  email confirmations are on (they are on in the hosted project).

${SHARED}`,
    title: 'Confirm your email',
    heading: 'Welcome to Padel Lobsters',
    intro: 'Type this code into the app to confirm your email and finish signing up.',
    codeLabel: 'Your code',
    buttonIntro: 'Or confirm on this device with the button.',
    buttonLabel: 'Confirm my email',
    link: { type: 'email', next: '/home' },
    wrapLinkText: true,
    footnote: `The code and link work once and expire in 1 hour.<br /><br />If you didn't sign up for Padel Lobsters, you can safely ignore this email.<br /><br />`,
  },
  recovery: {
    comment: `  Password reset email: sent by resetPasswordForEmail.

${SHARED}`,
    title: 'Reset your password',
    heading: 'Reset your password',
    intro: 'Type this code into the app to choose a new password.',
    codeLabel: 'Your reset code',
    buttonIntro: 'Or reset it on this device with the button.',
    buttonLabel: 'Choose a new password',
    link: { type: 'recovery', next: '/home' },
    wrapLinkText: true,
    footnote: `The code and link work once and expire in 1 hour.<br /><br />If you didn't ask to reset your password, you can safely ignore this email. Your password stays as it is.<br /><br />`,
  },
  reauthentication: {
    comment: `  Re-authentication email: sent by reauthenticate() before a password change
  on a session older than 24h (secure_password_change). Code only: the app
  passes it back as updateUser's nonce, so there is no link to follow.

${SHARED}`,
    title: "Confirm it's you",
    heading: "Confirm it's you",
    intro: 'Type this code into the app to finish changing your password.',
    codeLabel: 'Your code',
    footnote: `The code works once and expires in 1 hour.<br /><br />If you didn't try to change your password, don't share this code. Message a Padel Lobsters admin so we can check your account.`,
  },
  email_change: {
    comment: EMAIL_CHANGE_COMMENT,
    title: 'Confirm your email change',
    heading: 'Confirm your email change',
    intro: `A request to change your Padel Lobsters email {{ if .Email }}from <strong>{{ .Email }}</strong>{{ end }} {{ if .NewEmail }}to <strong>{{ .NewEmail }}</strong>{{ end }} was just submitted.`,
    buttonLabel: 'Confirm email change',
    link: { type: 'email_change', next: '/settings' },
    wrapLinkText: false,
    footnote: `You're receiving this at both the old and new addresses as a security heads-up. Confirming once from either inbox completes the change.<br /><br /> If you didn't request this change, ignore this email — no action is needed, and your account stays as-is.<br /><br />`,
  },
}
