const mongoose = require('mongoose');
const { sendMessage } = require("./sendMessage");
const { uri, mapProductToWooFormat, MappedProduct } = require("./productsFromCsv");



async function mapProductsForWooCommerce(ws) {
    let finalMappedProducts = [];

    try {
        // Connect to MongoDB
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

        const productsCollection = mongoose.connection.collection('csvProductData');
        const allProducts = await productsCollection.find({}).toArray();

        const attributesCollection = mongoose.connection.collection('product_attributes');
        const allAttributes = await attributesCollection.find({}).toArray();

        const categoriesCollection = mongoose.connection.collection('product_categories');

        const parentProducts = allProducts.filter(product => product["Variable|Simple"] === "variable");
        const variations = allProducts.filter(product => product["Variable|Simple"] === "variation");

        for (const parentProduct of parentProducts) {
            const mappedParentProduct = await mapProductToWooFormat(parentProduct, allAttributes, categoriesCollection);
            mappedParentProduct.variations = [];

            for (const variation of variations) {
                // console.log(variation)
                if (variation["Parent SKU"] === parentProduct["SKU"]) {
                    const mappedVariation = await mapProductToWooFormat(variation, allAttributes, categoriesCollection);
                    finalMappedProducts.push(mappedVariation);
                    mappedParentProduct.variations.push(mappedVariation.sku);
                }
            }

            finalMappedProducts.push(mappedParentProduct);
        }

        // const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
        for (const mappedProduct of finalMappedProducts) {
            const query = { sku: mappedProduct.sku };
            const update = { $set: mappedProduct };
            const options = { upsert: true };

            await MappedProduct.updateOne(query, update, options);
        }

        // mongoose.connection.close();
        if (ws) {
            sendMessage(ws, "Mapped products and their variations have been created/updated in the mappedProducts collection!");
        }
        return finalMappedProducts;

        // const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
        // await MappedProduct.insertMany(finalMappedProducts);
        // mongoose.connection.close();
        // if (ws) {
        //     sendMessage(ws, "Mapped products and their variations have been created and stored in the mappedProducts collection!");
        // }
        // return finalMappedProducts;
    } catch (err) {
        console.log(err);
        if (ws) {
            sendMessage(ws, `Error: ${err}`);
        }
        mongoose.connection.close();
    }
}
exports.mapProductsForWooCommerce = mapProductsForWooCommerce;
