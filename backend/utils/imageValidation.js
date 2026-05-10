const DEFAULT_ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

function resolveAllowedTypes(allowedTypes) {
  if (allowedTypes instanceof Set) {
    return allowedTypes;
  }

  if (Array.isArray(allowedTypes)) {
    return new Set(allowedTypes.map((type) => String(type).toLowerCase()));
  }

  return DEFAULT_ALLOWED_IMAGE_TYPES;
}

function isAllowedImageUrl(image, allowedTypes) {
  const normalizedImage = String(image || '').trim();
  if (!normalizedImage) {
    return false;
  }

  if (normalizedImage.startsWith('/public/images/')) {
    return true;
  }

  const match = normalizedImage.match(/^data:([^;,]+);base64,/i);
  if (!match) {
    return false;
  }

  return resolveAllowedTypes(allowedTypes).has(match[1].toLowerCase());
}

function normalizeImageList(images, allowedTypes) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => String(image || '').trim())
    .filter(Boolean)
    .filter((image) => isAllowedImageUrl(image, allowedTypes));
}

function normalizeSingleImage(image, allowedTypes) {
  const normalizedImage = String(image || '').trim();
  if (!normalizedImage) {
    return '';
  }

  return isAllowedImageUrl(normalizedImage, allowedTypes) ? normalizedImage : '';
}

module.exports = {
  DEFAULT_ALLOWED_IMAGE_TYPES,
  isAllowedImageUrl,
  normalizeImageList,
  normalizeSingleImage,
};
