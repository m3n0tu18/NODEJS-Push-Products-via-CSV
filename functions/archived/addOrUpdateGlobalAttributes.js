const mongoose = require('mongoose');
const { fetchAllFromWooCommerce } = require("./fetchAllFromWooCommerce");
const { WooCommerceRestApi, uri } = require("./productsFromCsv");

// Add or update Global Attributes within WooCommerce (USED AND WORKS)


async function addOrUpdateGlobalAttributes(ws) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const attributes = mongoose.connection.collection('product_attributes');
    const allAttributes = await attributes.find({}).toArray();

    const existingAttributes = await fetchAllFromWooCommerce("products/attributes", WooCommerceAPI);


    for (const attr of allAttributes) {
        // const existingAttribute = existingAttributes.data.find(a => a.slug === attr.name.toLowerCase());
        const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());


        if (existingAttribute) {
            try {
                // If attribute exists, update it (if necessary)
                await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
                    name: attr.name,
                    slug: attr.name.toLowerCase(),
                    type: "select",
                    order_by: "menu_order",
                    has_archives: true,
                    is_variation: attr.variation
                });
            } catch (err) {
                console.error(`Error updating attribute: ${err.message}`);
                continue; // Skip the current loop iteration
            }

            // When fetching terms for an attribute:
            const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${existingAttribute.id}/terms`, WooCommerceAPI);

            for (const term of attr.values) {
                const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

                try {
                    if (existingTerm) {
                        // If term exists, update it (if necessary)
                        await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`, {
                            name: term,
                            slug: term.toLowerCase()
                        });
                    } else {
                        // If term doesn't exist, create it
                        await WooCommerceAPI.post(`products/attributes/${existingAttribute.id}/terms`, {
                            name: term,
                            slug: term.toLowerCase()
                        });
                    }
                } catch (err) {
                    console.error(`Error handling term "${term}": ${err.message}`);
                }


            }

            // Delete any terms in WooCommerce that don't exist in the database
            // for (const existingTerm of existingTerms) {
            //     if (!attr.values.includes(existingTerm.name)) {
            //         try {
            //             await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`);
            //         } catch (err) {
            //             console.error(`Error deleting term "${existingTerm.name}": ${err.message}`);
            //         }
            //     }
            // }
        } else {
            try {
                // If attribute doesn't exist, create it and its terms
                const attributeResponse = await WooCommerceAPI.post("products/attributes", {
                    name: attr.name,
                    slug: attr.name.toLowerCase(),
                    type: "select",
                    order_by: "menu_order",
                    has_archives: true,
                    is_variation: attr.variation
                });

                if (attributeResponse.data && attributeResponse.data.id) {
                    await attributes.updateOne({ _id: attr._id }, {
                        $set: {
                            woo_id: attributeResponse.data.id,
                            updatedAt: new Date().toISOString()
                        }
                    });
                    for (const term of attr.values) {
                        await WooCommerceAPI.post(`products/attributes/${attributeResponse.data.id}/terms`, {
                            name: term,
                            slug: term.toLowerCase()
                        });
                    }
                }
            } catch (err) {
                console.error(`Error creating attribute "${attr.name}": ${err.message}`);

            }

        }
    }

    // Delete any attributes in WooCommerce that don't exist in the database
    // for (const existingAttribute of existingAttributes) {
    //     if (!allAttributes.some(attr => attr.name.toLowerCase() === existingAttribute.slug)) {
    //         try {
    //             await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}`);
    //         } catch (err) {
    //             console.error(`Error deleting attribute "${existingAttribute.slug}": ${err.message}`);
    //         }
    //     }
    // }
    mongoose.connection.close();
}
exports.addOrUpdateGlobalAttributes = addOrUpdateGlobalAttributes;
