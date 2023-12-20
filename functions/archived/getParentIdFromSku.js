const { WooCommerceRestApi } = require("./productsFromCsv");

// Helper function to get parent product ID from SKU

async function getParentIdFromSku(sku) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });
    try {
        const response = await WooCommerceAPI.get(`products`, { sku: sku });
        if (response.data && response.data.length > 0) {
            return response.data[0].id; // Assuming the first product is the correct one
        }
        return null;
    } catch (error) {
        console.error(`Error fetching product by SKU: ${sku}`, error);
        return null;
    }
}
exports.getParentIdFromSku = getParentIdFromSku;
