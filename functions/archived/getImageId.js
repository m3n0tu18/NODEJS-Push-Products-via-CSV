/**
 * Retrieves the ID of an image from the given media array based on the image URL.
 * @param {string} imageUrl - The URL of the image.
 * @param {Array} media - An array of media objects.
 * @returns {string|null} - The ID of the image if found, otherwise null.
 */
function getImageId(imageUrl, media) {
    if (!imageUrl) return null;
    const imageFilename = imageUrl.split('/').pop();
    const existingMedia = media.find(m => m.source_url.endsWith(imageFilename));
    return existingMedia ? existingMedia.id : null;
}
exports.getImageId = getImageId;
