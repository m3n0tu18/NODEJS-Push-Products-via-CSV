const { sendMessage } = require("./sendMessage");

// Function to check WooCommerce for existing products (UNUSED)


async function checkIfProductExists(ws, sku, token, destinationURL) {
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Making a GET request to WooCommerce to find the product by SKU
        const response = await WooCommerceAPI.get(`${destinationURL}/wp-json/wc/v3/products`, {
            headers: headers,
            params: { sku: sku }
        });

        if (response.data && response.data.length > 0) {
            if (ws) {
                sendMessage(ws, `Product with SKU ${sku} already exists in WooCommerce.`);
            }
            return true;
        } else {
            if (ws) {
                sendMessage(ws, `Product with SKU ${sku} does not exist in WooCommerce.`);
            }
            return false;
        }
    } catch (err) {
        console.log(err);
        if (ws) {
            sendMessage(ws, `Error while checking WooCommerce for SKU ${sku}: ${err}`);
        }
        return false;
    }
}
