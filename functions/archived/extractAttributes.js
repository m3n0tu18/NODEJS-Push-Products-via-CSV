const mongoose = require('mongoose');
const { uri, TempProduct } = require("./productsFromCsv");

// Extract and group terms from database to new collection (USED AND WORKS)


async function extractAttributes(ws) {
    // Connect to MongoDB
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    // Fields to extract from the database
    const fields = ["Accessories", "Baffle Colour", "Beam Angle", "Body Colour", "Colour Temperature", "Cut-Out", "Dimming", "IP Rating", "Lumen Output", "Socket Type", "Wattage", "mA"];

    // Fetch only the desired fields from MongoDB
    const products = await TempProduct.find({}, fields).lean().exec();

    // Create a new collection called attributes
    const attributes = mongoose.connection.collection('product_attributes');

    // Use a set to keep track of existing attributes and their values
    const attributeCache = {};

    // Loop through each product
    for (const product of products) {
        // Loop through each attribute in the product
        for (const attribute of fields) {
            const attrData = product[attribute];

            // Check if attrData is an array and has relevant attribute structure
            if (Array.isArray(attrData) && attrData[0] && attrData[0].variation !== undefined) {
                const variation = attrData[0].variation;

                for (const attrVal of attrData[0].values) {
                    if (!attributeCache[attribute]) {
                        // Fetch attribute from database if not in cache
                        const existingAttribute = await attributes.findOne({ name: attribute });
                        attributeCache[attribute] = existingAttribute ? new Set(existingAttribute.values) : new Set();

                        // If it doesn't exist in the database, create it
                        if (!existingAttribute) {
                            await attributes.insertOne({
                                name: attribute,
                                variation: variation,
                                createdAt: new Date().toISOString(),
                                values: []
                            });
                        }
                    }

                    // If value is not in cache, add to both cache and database
                    if (!attributeCache[attribute].has(attrVal)) {
                        attributeCache[attribute].add(attrVal);
                        await attributes.updateOne(
                            { name: attribute },
                            {
                                $push: {
                                    values: attrVal
                                }
                            }
                        );
                    }
                }
            }
        }
    }
}
exports.extractAttributes = extractAttributes;
