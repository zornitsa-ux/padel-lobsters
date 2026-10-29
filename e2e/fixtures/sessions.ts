import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../.auth/', import.meta.url))

/** Saved by auth.setup.ts; pass to `test.use({ storageState })`. */
export const SESSION_FILES = {
  admin: `${dir}admin.json`,
  player: `${dir}player.json`,
}
