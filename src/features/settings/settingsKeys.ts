export const settingsKeys = {
  all: () => ['settings'] as const,
  view: ({ signedIn }: { signedIn: boolean }) =>
    ['settings', signedIn ? 'member' : 'guest'] as const,
}
