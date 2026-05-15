// src/lib/imageProcessor.js
// Resizes any uploaded image to max 400x400px and compresses under 1MB.
// The original file is never sent anywhere — only the processed blob.

/**
 * Takes a File object from an <input type="file">,
 * draws it onto a canvas at max 400x400 (maintaining aspect ratio),
 * then compresses to JPEG under 1MB.
 *
 * Returns a Blob ready to upload to Supabase Storage.
 */
export async function processImage(file) {
  return new Promise((resolve, reject) => {
    // 1. Read the file into an image element
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // 2. Calculate dimensions — max 400x400, maintain aspect ratio
        const MAX = 400
        let { width, height } = img

        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height / width) * MAX)
            width = MAX
          } else {
            width = Math.round((width / height) * MAX)
            height = MAX
          }
        }

        // 3. Draw onto canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 4. Compress — start at quality 0.85, reduce until under 1MB
        const MAX_BYTES = 1 * 1024 * 1024 // 1MB
        let quality = 0.85

        function tryCompress() {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('Failed to process image')); return }

              if (blob.size <= MAX_BYTES || quality <= 0.3) {
                // Good enough — resolve with this blob
                resolve(blob)
              } else {
                // Too large — reduce quality and try again
                quality -= 0.10
                tryCompress()
              }
            },
            'image/jpeg',
            quality
          )
        }

        tryCompress()
      }
      img.onerror = () => reject(new Error('Invalid image file'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads a processed image blob to Supabase Storage.
 * Returns the public URL.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Blob} blob - from processImage()
 * @param {string} storeId - used to namespace files per store
 * @param {string} productName - used in filename
 */
export async function uploadProductImage(supabase, blob, storeId, productName) {
  // Generate a clean filename: storeId/timestamp-productname.jpg
  const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const filename = `${storeId}/${Date.now()}-${safeName}.jpg`

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filename, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) throw error

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path)

  return publicUrl
}

/**
 * Deletes an image from Supabase Storage by its public URL.
 * Call this when a product is deleted or its image replaced.
 */
export async function deleteProductImage(supabase, publicUrl) {
  if (!publicUrl) return
  // Extract path after /product-images/
  const marker = '/product-images/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return
  const path = publicUrl.slice(idx + marker.length)
  await supabase.storage.from('product-images').remove([path])
}
