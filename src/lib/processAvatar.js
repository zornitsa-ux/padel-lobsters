// Padel Lobsters — client-side avatar processing.
//
// Takes whatever the user picked (any image format the browser can decode,
// including HEIC on Safari) and returns a 256x256 center-cropped WebP blob.
// Drops a typical 4–10 MB phone photo to ~15–30 KB before upload, and gives
// every player file a uniform `.webp` extension so re-uploads can overwrite
// cleanly and the rendered <img> never has to deal with HEIC again.
//
// Usage:
//   const blob = await processAvatar(file)
//   await supabase.storage.from('avatars').upload(`player-${id}.webp`, blob, {
//     upsert: true, contentType: 'image/webp',
//   })

const SIZE = 256
const QUALITY = 0.85

export async function processAvatar(file) {
  if (!file) throw new Error('No file provided')

  const bitmap = await decode(file)

  // Center-crop the source to a square before scaling, so portrait/landscape
  // photos don't get stretched.
  const minDim = Math.min(bitmap.width, bitmap.height)
  const offsetX = (bitmap.width - minDim) / 2
  const offsetY = (bitmap.height - minDim) / 2

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, offsetX, offsetY, minDim, minDim, 0, 0, SIZE, SIZE)
  if (typeof bitmap.close === 'function') bitmap.close()

  // Try WebP first; fall back to JPEG on the rare browser that can't encode
  // WebP (very old Safari mostly). The extension is still .webp on Supabase
  // — if the browser produced a JPEG blob the contentType in the upload call
  // tells Supabase to serve it correctly regardless of extension.
  try {
    return await canvasToBlob(canvas, 'image/webp', QUALITY)
  } catch {
    return await canvasToBlob(canvas, 'image/jpeg', QUALITY)
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      type,
      quality,
    )
  })
}

// Decode the file into something drawable on a canvas.
// `createImageBitmap` is the modern path and handles HEIC on iOS Safari.
// For browsers that reject the format (e.g. HEIC on Chrome), we fall back to
// an <img> with an object URL — and if that fails too, the user gets a
// clear "couldn't read this image" error to swap to a JPEG.
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to <img> path
    }
  }
  return await loadViaImg(file)
}

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Couldn't read this image — please try a JPEG or PNG."))
    }
    img.src = url
  })
}
