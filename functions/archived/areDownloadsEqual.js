// exports.isProductDataChanged = isProductDataChanged;
// exports.areAttributesEqual = areAttributesEqual;
function areDownloadsEqual(newDownloads, currentDownloads) {
    // Compare the downloads arrays
    return JSON.stringify(newDownloads) === JSON.stringify(currentDownloads);
}
