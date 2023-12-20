function areImagesEqual(newImage, currentImage) {
    // Compare the image objects
    // This assumes images are compared based on an ID or src attribute
    return JSON.stringify(newImage) === JSON.stringify(currentImage);
}
