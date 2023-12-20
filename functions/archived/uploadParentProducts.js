const { sendMessage } = require("./sendMessage");
const { WooCommerceRestApi, prepareParentProductData, MappedProduct, isProductDataChanged, chunkArray } = require("./productsFromCsv");

// async function uploadParentProducts(ws, variableProducts) {
//     const WooCommerceAPI = new WooCommerceRestApi({
//         url: process.env.WP_DESTINATION_URL,
//         consumerKey: process.env.WC_CONSUMER_KEY,
//         consumerSecret: process.env.WC_CONSUMER_SECRET,
//         version: process.env.WC_API_VERSION,
//         queryStringAuth: true,
//     });
//     const parentProductsData = prepareParentProductData(variableProducts);
//     let createBatch = [];
//     let updateBatch = [];
//     let allCreatedIds = []; // Store all created IDs here
//     let allIds = []; // Store all ids (created and updated) here
//     let allSkus = []; // Store all skus (created and updated) here
//     for (const product of parentProductsData) {
//         const existingProduct = await MappedProduct.findOne({ sku: product.sku });
//         if (existingProduct && existingProduct.woo_id) {
//             updateBatch.push({ id: existingProduct.woo_id, ...product });
//         } else {
//             createBatch.push(product);
//         }
//     }
//     // Process in chunks of 100
//     const createChunks = chunkArray(createBatch, 100);
//     const updateChunks = chunkArray(updateBatch, 100);
//     // Create new parent products
//     for (const chunk of createChunks) {
//         const createResponse = await WooCommerceAPI.post("products/batch", { create: chunk });
//         const createdProducts = createResponse.data.create;
//         // Update MongoDB and collect IDs
//         for (const product of createdProducts) {
//             console.log(product)
//             await MappedProduct.updateOne({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
//             allCreatedIds.push(product.id); // Collect all IDs
//             allIds.push(product.id);
//             allSkus.push(product.sku);
//         }
//         sendMessage(ws, `Created a batch of ${chunk.length} new parent products`);
//     }
//     // Update existing parent products
//     for (const chunk of updateChunks) {
//         const updateResponse = await WooCommerceAPI.post("products/batch", { update: chunk });
//         const updatedProducts = updateResponse.data.update;
//         for (const product of updatedProducts) {
//             console.log(product)
//             // await MappedProduct.updateOne({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
//             allIds.push(product.id);
//             allSkus.push(product.sku);
//         }
//         sendMessage(ws, `Updated a batch of ${chunk.length} parent products`);
//     }
//     console.log(allIds)
//     console.log(allSkus)
//     // Return IDs and SKUs for further processing
//     return { createdParentIds: allIds, createdParentSkus: allSkus };
// }

async function uploadParentProducts(ws, variableProducts) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });
    const parentProductsData = prepareParentProductData(variableProducts);

    let createBatch = [];
    let updateBatch = [];
    let allIds = [];
    let allSkus = [];

    for (const product of parentProductsData) {
        const existingProduct = await MappedProduct.findOne({ sku: product.sku });

        if (existingProduct && existingProduct.woo_id) {
            // Fetch current product data from WooCommerce
            const currentProductResponse = await WooCommerceAPI.get(`products/${existingProduct.woo_id}`);
            const currentProduct = currentProductResponse.data;

            if (isProductDataChanged(product, currentProduct)) {
                console.log(`Updating product with SKU: ${product.sku}`);
                updateBatch.push({ id: existingProduct.woo_id, ...product });
            }
        } else {
            console.log(`Creating new product with SKU: ${product.sku}`);
            createBatch.push(product);
        }
    }

    // Process creation and update in chunks of 100
    const createChunks = chunkArray(createBatch, 100);
    const updateChunks = chunkArray(updateBatch, 100);

    // Create new parent products
    for (const chunk of createChunks) {
        const createResponse = await WooCommerceAPI.post("products/batch", { create: chunk });
        for (const product of createResponse.data.create) {
            await MappedProduct.updateOne({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
            allIds.push(product.id);
            allSkus.push(product.sku);
        }
        sendMessage(ws, `Created a batch of ${chunk.length} new parent products`);
    }

    // Update existing parent products
    for (const chunk of updateChunks) {
        const updateResponse = await WooCommerceAPI.post("products/batch", { update: chunk });
        for (const product of updateResponse.data.update) {
            await MappedProduct.updateOne({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
            allIds.push(product.id);
            allSkus.push(product.sku);
        }
        sendMessage(ws, `Updated a batch of ${chunk.length} parent products`);
    }

    return { createdParentIds: allIds, createdParentSkus: allSkus };
}
exports.uploadParentProducts = uploadParentProducts;
