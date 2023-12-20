const { getImageId } = require("./getImageId");

function modifyMappedProductsWithMedia(mappedProducts, media) {
    mappedProducts.forEach(product => {
        if (product.images && product.images.length > 0) {
            product.images.forEach(image => {
                if (image.src) {
                    const existingImageId = getImageId(image.src, media);
                    if (existingImageId) {
                        image.id = existingImageId;
                        delete image.src;
                    }
                }
            });
        }
    });
    return mappedProducts;
}
exports.modifyMappedProductsWithMedia = modifyMappedProductsWithMedia;
