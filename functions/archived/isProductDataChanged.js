const { areAttributesEqual, areDownloadsEqual, areImagesEqual } = require("./productsFromCsv");

function isProductDataChanged(newData, currentData) {
    // Compare regular price
    if (newData.regular_price !== currentData.regular_price) return true;
    if (newData.price !== currentData.price) return true;
    if (newData.trade_price !== currentData.trade_price) return true;

    // Compare attributes
    if (!areAttributesEqual(newData.attributes, currentData.attributes)) return true;

    // Compare other fields
    if (newData.downloadable !== currentData.downloadable) return true;
    if (!areDownloadsEqual(newData.downloads, currentData.downloads)) return true;
    if (newData.sku !== currentData.sku) return true;
    if (newData.height !== currentData.height) return true;
    if (newData.width !== currentData.width) return true;
    if (newData.length !== currentData.length) return true;
    if (newData.description !== currentData.description) return true;
    if (!areImagesEqual(newData.image, currentData.image)) return true;

    return false;
}
