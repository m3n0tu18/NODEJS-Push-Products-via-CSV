const mongoose = require('mongoose');
const { fetchAllFromWooCommerce } = require("./fetchAllFromWooCommerce");
const { uri, WooCommerceRestApi } = require("./productsFromCsv");

// exports.mapProductToWooFormat = mapProductToWooFormat;



async function saveCategoriesToWooCommerce() {
    // 1. Connect to MongoDB and fetch csvProductData
    // Connect to MongoDB
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const csvProductData = mongoose.connection.collection('csvProductData');
    const allCategories = await csvProductData.find({}).toArray();


    // Get product categproes from WooCommerce
    const wooCats = await fetchAllFromWooCommerce("products/categories");

    if (wooCats.length > 0) return;

    // const client = await MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    // const db = client.db('YOUR_DB_NAME');
    // const csvProductData = await db.collection('csvProductData').find({}).toArray();
    // 2. Extract unique categories
    const uniqueCategories = [...new Set(allCategories.flatMap(product => product.Category))];

    // 3. Save unique categories to product_categories collection
    const categoriesToInsert = uniqueCategories.map(category => ({ name: category }));
    await mongoose.connection.collection('product_categories').insertMany(categoriesToInsert);

    // 4. POST categories to WooCommerce and get woo_id
    for (let category of categoriesToInsert) {
        const WooCommerceAPI = new WooCommerceRestApi({
            url: process.env.WP_DESTINATION_URL,
            consumerKey: process.env.WC_CONSUMER_KEY,
            consumerSecret: process.env.WC_CONSUMER_SECRET,
            version: process.env.WC_API_VERSION,
            queryStringAuth: true,
        });
        const response = await WooCommerceAPI.post('products/categories', { name: category.name });
        const woo_id = response.data.id;

        // 5. Update product_categories collection with woo_id
        await mongoose.connection.collection('product_categories').updateOne({ name: category.name }, {
            $set: {
                woo_id: woo_id,
                updatedAt: new Date().toISOString()
            }
        });
    }

    mongoose.connection.close();
}
exports.saveCategoriesToWooCommerce = saveCategoriesToWooCommerce;
