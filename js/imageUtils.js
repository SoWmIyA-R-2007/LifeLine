/**
 * Lifeline - Image Compression & Utility Module
 * Client-side optimization, validation, and multi-file processing
 */

export const ImageUtils = {
  // Max file size allowed before compression (e.g. 30MB)
  MAX_FILE_BYTES: 30 * 1024 * 1024,

  /**
   * Format byte count into human-readable string
   * @param {number} bytes
   * @param {number} decimals
   * @returns {string}
   */
  formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  /**
   * Validate image file type and size
   * @param {File} file
   */
  validateImageFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
    if (!file.type.startsWith('image/') && !validMimes.includes(file.type)) {
      throw new Error(`"${file.name}" is not a recognized image format.`);
    }
    if (file.size > this.MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" exceeds the maximum allowed file size of 30MB.`);
    }
    return true;
  },

  /**
   * Reads a File object and converts it to a Data URL (base64)
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Resize and compress a single image file before upload
   * @param {File} file - Original image file
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = 1600,
      maxHeight = 1600,
      quality = 0.82,
      outputFormat = 'image/webp'
    } = options;

    this.validateImageFile(file);

    // Skip SVGs or GIFs to preserve vector scalability & animations
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const dataUrl = await this.fileToDataUrl(file);
      return {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        file,
        blob: file,
        previewUrl: URL.createObjectURL(file),
        dataUrl,
        originalSize: file.size,
        compressedSize: file.size,
        savedPercent: 0,
        width: 0,
        height: 0
      };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;

        // Scale proportionally if dimensions exceed max boundaries
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // White background for JPEG conversion
        if (outputFormat === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Fallback check for browser WebP support
        let targetMime = outputFormat;
        try {
          const testCanvas = document.createElement('canvas');
          testCanvas.width = 1;
          testCanvas.height = 1;
          const testUri = testCanvas.toDataURL('image/webp');
          if (!testUri.startsWith('data:image/webp')) {
            targetMime = 'image/jpeg';
          }
        } catch {
          targetMime = 'image/jpeg';
        }

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }

            const ext = targetMime === 'image/webp' ? '.webp' : '.jpg';
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const newFileName = `${baseName}_opt${ext}`;

            const compressedFile = new File([blob], newFileName, {
              type: targetMime,
              lastModified: Date.now()
            });

            const originalSize = file.size;
            const compressedSize = compressedFile.size;
            const savedPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
            const previewUrl = URL.createObjectURL(compressedFile);
            const dataUrl = await ImageUtils.fileToDataUrl(compressedFile);

            resolve({
              id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              file: compressedFile,
              blob,
              previewUrl,
              dataUrl,
              originalSize,
              compressedSize,
              savedPercent,
              width,
              height
            });
          },
          targetMime,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to load image "${file.name}" for optimization.`));
      };

      img.src = objectUrl;
    });
  },

  /**
   * Compress multiple files concurrently with progress notification
   * @param {FileList|Array<File>} files
   * @param {Object} options
   * @param {Function} [onProgress] - (processedCount, totalCount) => void
   * @returns {Promise<Array<Object>>}
   */
  async compressMultipleImages(files, options = {}, onProgress = null) {
    const list = Array.from(files);
    const results = [];

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const compressed = await this.compressImage(file, options);
        results.push(compressed);
      } catch (err) {
        console.warn(`[ImageUtils] Skipping invalid file ${file.name}:`, err);
      }
      if (onProgress) {
        onProgress(i + 1, list.length);
      }
    }

    return results;
  }
};
