// Pushes Product from MongoDB to WooCommerce
// CURRENTLY WORKS - COMMENTED OUT FOR CONSISTENCY
// async function pushProductsToWooCommerce(ws, mappedProducts) {
//     try {
//         const mediaResponse = await fetch(`${process.env.WP_DESTINATION_URL}/wp-json/wp/v2/media`);
//         const media = await mediaResponse.json();
//         // Helper function to check if an image already exists in the WooCommerce media library
//         const getImageId = (imageUrl) => {
//             if (!imageUrl) return null;  // Check if imageUrl exists
//             const imageFilename = imageUrl.split('/').pop();
//             const existingMedia = media.find(m => m.source_url.endsWith(imageFilename));
//             return existingMedia ? existingMedia.id : null;
//         };
//         const getVariationImageId = (imageName) => {
//             const existingMedia = media.find(m => m.title.rendered === imageName);
//             return existingMedia ? existingMedia.id : null;
//         };
//         // Modify mappedProducts to use existing image ID if available
//         mappedProducts.forEach(product => {
//             if (product.images && product.images.length > 0) {  // Check if images array exists and is not empty
//                 product.images.forEach(image => {
//                     if (image.src) {  // Check if src property exists
//                         const existingImageId = getImageId(image.src);
//                         if (existingImageId) {
//                             image.id = existingImageId;
//                             delete image.src; // remove src key if image ID is present
//                         }
//                     }
//                 });
//             }
//         });
//         // Separate variable products and variations
//         const variableProducts = mappedProducts.filter(p => p.type === "variable");
//         // console.log(variableProducts[0].categories)
//         // return
//         const variations = mappedProducts.filter(p => p.type === "variation");
//         // Prepare data for parent variable products
//         const parentProductsData = variableProducts.map(product => {
//             // console.log(product.categories);
//             return {
//                 name: product.name,
//                 slug: product.slug,
//                 type: product.type,
//                 status: product.status,
//                 description: product.description,
//                 sku: product.sku,
//                 price: product.price,
//                 regular_price: product.regular_price,
//                 attributes: product.attributes.map(attr => ({
//                     id: attr.id,
//                     name: attr.name,
//                     visible: true,
//                     variation: attr.variation,
//                     options: attr.option
//                 })),
//                 downloads: product.downloads,
//                 images: product.images,
//                 // categories: product.categories.map(category => ({
//                 //     name: category.name
//                 // })),
//                 categories: product.categories,
//                 tags: product.tags,
//             };
//         });
//         console.log("Preparing to upload parent products...");
//         sendMessage(ws, "Preparing to upload parent products...")
//         // Split the parent products data into chunks of 100
//         const parentProductsChunks = chunkArray(parentProductsData, 100);
//         let createdParentSkus = [];
//         let createdParentIds = [];
//         for (const chunk of parentProductsChunks) {
//             const WooCommerceAPI = new WooCommerceRestApi({
//                 url: process.env.WP_DESTINATION_URL,
//                 consumerKey: process.env.WC_CONSUMER_KEY,
//                 consumerSecret: process.env.WC_CONSUMER_SECRET,
//                 version: process.env.WC_API_VERSION,
//                 queryStringAuth: true,
//             });
//             const response = await WooCommerceAPI.post("products/batch", { create: chunk });
//             createdParentIds = createdParentIds.concat(response.data.create.map(p => p.id));
//             createdParentSkus = createdParentSkus.concat(response.data.create.map(p => p.sku));
//             sendMessage(ws, `Batch of ${chunk.length} parent products processed`);
//         }
//         console.log(`Successfully uploaded ${createdParentIds.length} parent products.`);
//         sendMessage(ws, `Successfully uploaded ${createdParentIds.length} parent products.`)
//         // Prepare data for variations
//         const variationsData = [];
//         createdParentSkus.forEach((parentSku, index) => {
//             const parentId = createdParentIds[index];
//             const childVariations = variations.filter(v => v.sku.startsWith(parentSku));
//             const variationData = childVariations.map(variation => {
//                 const variationImage = variation.images && variation.images[0]; // Assuming each variation has at most one image
//                 // const variationImageId = variationImage ? getImageId(variationImage.src) : null;
//                 const variationImageId = variationImage ? getVariationImageId(variationImage.name) : null;
//                 return {
//                     regular_price: variation.regular_price,
//                     attributes: variation.attributes.map(attr => ({
//                         id: attr.id,
//                         name: attr.name,
//                         option: attr.option[0]
//                     })),
//                     downloadable: variation.downloadable,
//                     downloads: variation.downloads.map(download => ({
//                         name: download.name,
//                         file: download.file
//                     })),
//                     sku: variation.sku,
//                     height: variation.height,
//                     width: variation.width,
//                     length: variation.length,
//                     description: variation.description,
//                     image: variationImageId ? { id: variationImageId } : { src: variationImage.src },  // Setting variation image
//                 };
//             });
//             variationsData.push({ parentId: parentId, data: variationData });
//         });
//         console.log("Preparing to upload variations...");
//         sendMessage(ws, "Preparing to upload variations...")
//         let totalVariationsUploaded = 0;
//         // Split the variations data into chunks of 100
//         for (let variationBatch of variationsData) {
//             const variationChunks = chunkArray(variationBatch.data, 100);
//             for (const chunk of variationChunks) {
//                 const WooCommerceAPI = new WooCommerceRestApi({
//                     url: process.env.WP_DESTINATION_URL,
//                     consumerKey: process.env.WC_CONSUMER_KEY,
//                     consumerSecret: process.env.WC_CONSUMER_SECRET,
//                     version: process.env.WC_API_VERSION,
//                     queryStringAuth: true,
//                 });
//                 await WooCommerceAPI.post(`products/${variationBatch.parentId}/variations/batch`, { create: chunk });
//                 totalVariationsUploaded += chunk.length;
//                 sendMessage(ws, `Batch of ${chunk.length} variations processed`);
//             }
//         }
//         console.log(`Successfully uploaded ${totalVariationsUploaded} variations.`);
//         sendMessage(ws, `Successfully uploaded ${totalVariationsUploaded} variations.`)
//         console.log("Successfully pushed products and their variations to WooCommerce!");
//         sendMessage(ws, "Successfully pushed products and their variations to WooCommerce!")
//     } catch (error) {
//         console.log("Error pushing products to WooCommerce:", error);
//         sendMessage(ws, `Error pushing products to WooCommerce: ${error}`)
//     }
// }
// Fetch Media from WooCommerce

async function fetchMediaFromWooCommerce() {
    const mediaResponse = await fetch(`${process.env.WP_DESTINATION_URL}/wp-json/wp/v2/media`);
    return await mediaResponse.json();
}
exports.fetchMediaFromWooCommerce = fetchMediaFromWooCommerce;
