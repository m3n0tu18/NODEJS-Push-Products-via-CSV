require("dotenv").config();
// const MongoClient = require('mongodb').MongoClient;


const dbCollection = process.env.COLLECTION;
const database = process.env.DATABASE;
const uri = `${process.env.MONGO_URL}/${database}`;
const delayTimeout = process.env.DELAY_TIMEOUT;
const destinationURL = process.env.WP_DESTINATION_URL;
const mongoose = require('mongoose');
// const axios = require("axios");
const Buffer = require('buffer').Buffer;
const { send } = require('express/lib/response');
const xml2js = require('xml2js');
const path = require('path');
const fs = require('fs')
const csv = require('csvtojson');  // Move this to the top of your file for better performance

const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default

// const WooCommerceAPI = new WooCommerceRestApi({
//     url: process.env.WP_DESTINATION_URL,
//     consumerKey: process.env.WC_CONSUMER_KEY,
//     consumerSecret: process.env.WC_CONSUMER_SECRET,
//     version: process.env.WC_API_VERSION,
//     queryStringAuth: true,
// });

// console.log(WooCommerceAPI instanceof WooCommerceRestApi); // Should return true


// data cleaner upper (used in schema) (USED AND WORKS)
function splitAndTrim(value) {
    return typeof value === 'string' ? value.split('|').map(item => item.trim()) : value;
}

// Mongo DB Schema (USED AND WORKS)
const tempProductSchema = new mongoose.Schema({
    "SKU": {
        type: String,
        required: true,
        unique: true,
    },
    "Parent SKU": String,
    "Product Title": String,
    "Description": String,
    "Trade Price": Number,
    "Platinum Price (-50%)": Number,
    "Type": String,
    "Category": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Tags": {
        type: Array,
        get: tags => tags,
        set: tags => typeof tags === 'string' ? tags.split('|').map(tag => tag.trim()) : tags
    },

    "Body Colour": {
        type: Array,
        get: values => values,
        set: splitAndTrim,
    },
    "Baffle Colour": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Socket Type": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Wattage": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Colour Temperature": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Beam Angle": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Dimming": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Accessories": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "mA": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Lumen Output": {
        type: Array,
        get: values => values,
        set: splitAndTrim
    },
    "Height": String,
    "Width": String,
    "Length": String,
    "Cut-Out": String,
    "IP Rating": String,
    "Image URL": {
        type: Array,
        get: imageURL => imageURL,
        set: imageURL => typeof imageURL === 'string' ? imageURL.split('|').map(tag => tag.trim()) : imageURL,
    },
    "Instruction Manual": {
        type: Array,
        get: instructionManual => instructionManual,
        set: instructionManual => typeof instructionManual === 'string' ? instructionManual.split('|').map(tag => tag.trim()) : instructionManual,
    },
    "Photometry": {
        type: Array,
        get: photometry => photometry,
        set: photometry => typeof photometry === 'string' ? photometry.split('|').map(tag => tag.trim()) : photometry,
    },
    "CAD Drawings": {
        type: Array,
        get: values => values,
        set: values => typeof values === 'string' ? values.split('|').map(tag => tag.trim()) : values,
    },
    "Datasheet": {
        type: Array,
        get: datasheet => datasheet,
        set: datasheet => typeof datasheet === 'string' ? datasheet.split('|').map(tag => tag.trim()) : datasheet,
    },
    createdAt: { type: Date, default: Date.now, immutable: true },
    lastModified: { type: Date, default: Date.now }
})

tempProductSchema.pre('save', function (next) {
    this.lastModified = new Date();
    next();
});

// Preparing WooCommerce Schema for Batch Upload (IN PROGRESS)
const productSchema = new mongoose.Schema({
    name: String,
    slug: String,
    date_created: String,
    date_created_gmt: String,
    date_modified: String,
    date_modified_gmt: String,
    type: String,
    status: String,
    featured: Boolean,
    catalog_visibility: String,
    description: String,
    short_description: String,
    sku: {
        type: String,
        unique: true,
    },
    parent_sku: String,
    price: String,
    regular_price: String,
    trade_price: String,
    sale_price: String,
    date_on_sale_from: String,
    date_on_sale_from_gmt: String,
    date_on_sale_to: String,
    date_on_sale_to_gmt: String,
    price_html: String,
    on_sale: Boolean,
    purchasable: Boolean,
    total_sales: Number,
    virtual: Boolean,
    downloadable: Boolean,
    downloads: Array,
    download_limit: Number,
    download_expiry: Number,
    external_url: String,
    button_text: String,
    tax_status: String,
    tax_class: String,
    manage_stock: Boolean,
    stock_quantity: Number,
    stock_status: String,
    backorders: String,
    backorders_allowed: Boolean,
    backordered: Boolean,
    sold_individually: Boolean,
    weight: String,
    dimensions: Object,
    shipping_required: Boolean,
    shipping_taxable: Boolean,
    shipping_class: String,
    shipping_class_id: Number,
    reviews_allowed: Boolean,
    average_rating: String,
    rating_count: Number,
    related_ids: Array,
    upsell_ids: Array,
    cross_sell_ids: Array,
    parent_id: Number,
    purchase_note: String,
    categories: Array,
    tags: Array,
    images: Array,
    attributes: Array,
    default_attributes: Array,
    variations: Array,
    grouped_products: Array,
    menu_order: Number,
    meta_data: Array,
    woo_id: Number,
    _links: Object
})

// Mongo DB Model (USED AND WORKS)
const TempProduct = mongoose.model('TempProduct', tempProductSchema, 'csvProductData');
// const Product = mongoose.model('Product', productSchema, 'wooCommerceProducts')

// Websocket Sender function (USED AND WORKS)
function sendMessage(ws, message) {
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(message);
    }
}

// Sleeper function (USED AND WORKS)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Function to convert CSV to MongoDB (USED AND WORKS)
async function convertCSVToMongo(ws) {
    const csvFilePath = './csv_data/tubular-data-smallio.csv';
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

        // Read CSV file
        const jsonArray = await csv().fromFile(csvFilePath);
        let updatedSKUs = [];  // Store SKUs that have been updated
        let createdCount = 0;  // Count of SKUs that have been created
        let matchedButNotModifiedCount = 0;

        for (let item of jsonArray) {

            // Enhance the item with 'variation: true' for specific fields
            ["Body Colour", "Baffle Colour", "Wattage", "Colour Temperature", "Beam Angle", "Dimming", "Accessories"].forEach(field => {
                if (item[field]) {
                    item[field] = {
                        variation: true,
                        values: splitAndTrim(item[field])
                    };
                }
            });

            // Use 'SKU' as the unique identifier for your items
            const result = await TempProduct.updateOne(
                { SKU: item.SKU },
                item,
                { upsert: true, new: true, setDefaultsOnInsert: true }  // This will insert the item if it doesn't exist
            );

            // Tally up the counts and updated SKUs
            if (result.modifiedCount === 1) {
                updatedSKUs.push(item.SKU);
            } else if (result.upsertedCount === 1) {
                createdCount++;
            } else if (result.matchedCount === 1 && result.modifiedCount === 0) {
                matchedButNotModifiedCount++;
            }
        }

        // Construct the message based on the counts
        if (createdCount > 0) {
            sendMessage(ws, `- <strong>${createdCount} row(s)</strong> have been added to the database table: <strong>${dbCollection}</strong>`);
        }
        if (updatedSKUs.length > 0) {
            sendMessage(ws, `Updated SKUs: <strong>${updatedSKUs.join('| ')}</strong>`);
            sendMessage(ws, `- <strong>${updatedSKUs.length} row(s)</strong> have been updated in the database table: <strong>${dbCollection}</strong>`);
        }
        if (createdCount === 0 && updatedSKUs.length === 0) {
            sendMessage(ws, `No change required.`);
        }
        if (matchedButNotModifiedCount > 0) {
            sendMessage(ws, `- <strong>${matchedButNotModifiedCount} row(s)</strong> were matched but not modified in the database table: <strong>${dbCollection}</strong>`);
        }

        // Close the Mongoose connection
        await mongoose.connection.close();
    } catch (err) {
        console.log(err);
        sendMessage(ws, `Error: ${err}`);
    }
}


// Get data from Database (UNUSED)
async function getDataFromDatabase(ws) {
    let results = []
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

        // Fetching data from MongoDB
        results = await TempProduct.find({});

        // If web socket exists, send the data
        if (ws) {
            sendMessage(ws, `Fetched ${results.length} products from the database.`);
        }

        // Close the Mongoose connection
        await mongoose.connection.close();
    } catch (err) {
        console.log(err);
        if (ws) {
            sendMessage(ws, `Error: ${err}`);
        }
    }
    return results;
}

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

// Function to fetch all results from WooCommerce with pagination (USED AND WORKS)
async function fetchAllFromWooCommerce(endpoint) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });
    let page = 1;
    let results = [];
    while (true) {
        const response = await WooCommerceAPI.get(endpoint, { params: { per_page: 100, page } });
        results = results.concat(response.data);
        if (response.data.length < 100) break; // Less than 100 results means it's the last page
        page++;
    }
    return results;
}

// Add or update Global Attributes within WooCommerce (USED AND WORKS)
// async function addOrUpdateGlobalAttributes(ws) {
//     const WooCommerceAPI = new WooCommerceRestApi({
//         url: process.env.WP_DESTINATION_URL,
//         consumerKey: process.env.WC_CONSUMER_KEY,
//         consumerSecret: process.env.WC_CONSUMER_SECRET,
//         version: process.env.WC_API_VERSION,
//         queryStringAuth: true,
//     });
//     await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//     const attributes = mongoose.connection.collection('product_attributes');
//     const allAttributes = await attributes.find({}).toArray();

//     const existingAttributes = await fetchAllFromWooCommerce("products/attributes");


//     for (const attr of allAttributes) {
//         // const existingAttribute = existingAttributes.data.find(a => a.slug === attr.name.toLowerCase());
//         const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());
//         if (existingAttribute) {
//             try {
//                 // If attribute exists, update it (if necessary)
//                 await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
//                     name: attr.name,
//                     slug: attr.name.toLowerCase(),
//                     type: "select",
//                     order_by: "menu_order",
//                     has_archives: true,
//                     is_variation: attr.variation
//                 });
//                 sendMessage(ws, `Attribute <strong>${attr.name}</strong> updated.`);
//             } catch (err) {
//                 console.error(`Error updating attribute: ${err.message}`);
//                 sendMessage(ws, `Error updating attribute <strong>${attr.name}</strong>.`)
//                 continue; // Skip the current loop iteration
//             }

//             // When fetching terms for an attribute:
//             const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${existingAttribute.id}/terms`);

//             for (const term of attr.values) {
//                 const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

//                 try {
//                     if (existingTerm) {
//                         // If term exists, update it (if necessary)
//                         await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term <strong>'${term}'</strong> under attribute <strong>'${attr.name}'</strong> updated.`);
//                     } else {
//                         // If term doesn't exist, create it
//                         await WooCommerceAPI.post(`products/attributes/${existingAttribute.id}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term <strong>'${term}'</strong> under attribute <strong>'${attr.name}'</strong> created.`);
//                     }
//                 } catch (err) {
//                     console.error(`Error handling term "${term}": ${err.message}`);
//                     sendMessage(ws, `Error handling term <strong>${term}</strong> under attribute <strong>'${attr.name}</strong>`);

//                 }


//             }

//             // Delete any terms in WooCommerce that don't exist in the database
//             // for (const existingTerm of existingTerms) {
//             //     if (!attr.values.includes(existingTerm.name)) {
//             //         try {
//             //             await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`);
//             //         } catch (err) {
//             //             console.error(`Error deleting term "${existingTerm.name}": ${err.message}`);
//             //         }
//             //     }
//             // }

//         } else {
//             try {
//                 // If attribute doesn't exist, create it and its terms
//                 const attributeResponse = await WooCommerceAPI.post("products/attributes", {
//                     name: attr.name,
//                     slug: attr.name.toLowerCase(),
//                     type: "select",
//                     order_by: "menu_order",
//                     has_archives: true,
//                     is_variation: attr.variation
//                 });

//                 if (attributeResponse.data && attributeResponse.data.id) {
//                     await attributes.updateOne({ _id: attr._id }, {
//                         $set: {
//                             woo_id: attributeResponse.data.id,
//                             updatedAt: new Date().toISOString()
//                         }
//                     });
//                     for (const term of attr.values) {
//                         await WooCommerceAPI.post(`products/attributes/${attributeResponse.data.id}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                     }
//                 }
//             } catch (err) {
//                 console.error(`Error creating attribute "${attr.name}": ${err.message}`);
//                 sendMessage(ws, `Error creating attribute "${attr.name}" - It already exists!`)
//             }

//         }
//     }

//     // Delete any attributes in WooCommerce that don't exist in the database
//     // for (const existingAttribute of existingAttributes) {
//     //     if (!allAttributes.some(attr => attr.name.toLowerCase() === existingAttribute.slug)) {
//     //         try {
//     //             await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}`);
//     //         } catch (err) {
//     //             console.error(`Error deleting attribute "${existingAttribute.slug}": ${err.message}`);

//     //         }
//     //     }
//     // }

// }

// async function addOrUpdateGlobalAttributes(ws) {
//     const WooCommerceAPI = new WooCommerceRestApi({
//         url: process.env.WP_DESTINATION_URL,
//         consumerKey: process.env.WC_CONSUMER_KEY,
//         consumerSecret: process.env.WC_CONSUMER_SECRET,
//         version: process.env.WC_API_VERSION,
//         queryStringAuth: true,
//     });

//     try {
//         const existingAttributes = await fetchAllFromWooCommerce("products/attributes");

//         for (const attr of allAttributes) {
//             let attributeId;

//             const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());

//             if (existingAttribute) {
//                 try {
//                     // Attribute exists, update it
//                     await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
//                         name: attr.name,
//                         slug: attr.name.toLowerCase(),
//                         type: "select",
//                         order_by: "menu_order",
//                         has_archives: true,
//                         is_variation: attr.variation
//                     });
//                     attributeId = existingAttribute.id;
//                     sendMessage(ws, `Attribute '${attr.name}' updated.`);
//                 } catch (err) {
//                     console.error(`Error updating attribute '${attr.name}': ${err.message}`);
//                     sendMessage(ws, `Error updating attribute '${attr.name}'.`);
//                     continue;
//                 }
//             } else {
//                 try {
//                     // Create new attribute
//                     const response = await WooCommerceAPI.post("products/attributes", {
//                         name: attr.name,
//                         slug: attr.name.toLowerCase(),
//                         type: "select",
//                         order_by: "menu_order",
//                         has_archives: true,
//                         is_variation: attr.variation
//                     });
//                     attributeId = response.data.id;
//                     sendMessage(ws, `Attribute '${attr.name}' created.`);
//                 } catch (err) {
//                     console.error(`Error creating attribute '${attr.name}': ${err.message}`);
//                     sendMessage(ws, `Error creating attribute '${attr.name}', it may already exist.`);
//                     continue;
//                 }
//             }

//             // Handle terms for the attribute
//             const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${attributeId}/terms`);

//             for (const term of attr.values) {
//                 const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

//                 try {
//                     if (existingTerm) {
//                         // If term exists, update it
//                         await WooCommerceAPI.put(`products/attributes/${attributeId}/terms/${existingTerm.id}`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term '${term}' under attribute '${attr.name}' updated.`);
//                     } else {
//                         // If term doesn't exist, create it
//                         await WooCommerceAPI.post(`products/attributes/${attributeId}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term '${term}' under attribute '${attr.name}' created.`);
//                     }
//                 } catch (err) {
//                     console.error(`Error handling term '${term}' under attribute '${attr.name}': ${err.message}`);
//                     sendMessage(ws, `Error handling term '${term}' under attribute '${attr.name}'.`);
//                 }
//             }
//         }
//     } catch (err) {
//         console.error(`Error in addOrUpdateGlobalAttributes: ${err.message}`);
//         sendMessage(ws, 'An error occurred while updating global attributes.');
//     }
// }



// Another One ---
// async function addOrUpdateGlobalAttributes(ws) {
//     const WooCommerceAPI = new WooCommerceRestApi({
//         url: process.env.WP_DESTINATION_URL,
//         consumerKey: process.env.WC_CONSUMER_KEY,
//         consumerSecret: process.env.WC_CONSUMER_SECRET,
//         version: process.env.WC_API_VERSION,
//         queryStringAuth: true,
//     });

//     try {
//         // Connect to MongoDB and fetch all attributes from the collection
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         // Fetch existing attributes from WooCommerce
//         const existingAttributes = await fetchAllFromWooCommerce("products/attributes");

//         for (const attr of allAttributes) {
//             let attributeId;

//             // Check if attribute already exists in WooCommerce
//             const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());

//             if (existingAttribute) {
//                 // Attribute exists, update it
//                 try {
//                     await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
//                         name: attr.name,
//                         slug: attr.name.toLowerCase(),
//                         type: "select",
//                         order_by: "menu_order",
//                         has_archives: true,
//                         is_variation: attr.variation
//                     }).then(async (response) => {
//                         // attributeId = existingAttribute.id
//                         attributeId = response.data.id;
//                         if (response.data && response.data.id) {
//                             await attributesCollection.updateOne({ _id: attr._id }, {
//                                 $set: {
//                                     woo_id: response.data.id,
//                                     updatedAt: new Date().toISOString()
//                                 }
//                             });
//                             sendMessage(ws, `Attribute '${attr.name}' created.`);
//                         }
//                     })

//                     sendMessage(ws, `Attribute '${attr.name}' updated.`);
//                 } catch (err) {
//                     console.error(`Error updating attribute '${attr.name}': ${err.message}`);
//                     sendMessage(ws, `Error updating attribute '${attr.name}'.`);
//                     continue;
//                 }
//             } else {
//                 // Create new attribute
//                 try {
//                     await WooCommerceAPI.post("products/attributes", {
//                         name: attr.name,
//                         slug: attr.name.toLowerCase(),
//                         type: "select",
//                         order_by: "menu_order",
//                         has_archives: true,
//                         is_variation: attr.variation
//                     }).then(async (response) => {
//                         attributeId = response.data.id;
//                         if (response.data && response.data.id) {
//                             await attributesCollection.updateOne({ _id: attr._id }, {
//                                 $set: {
//                                     woo_id: response.data.id,
//                                     updatedAt: new Date().toISOString()
//                                 }
//                             });
//                             sendMessage(ws, `Attribute '${attr.name}' created.`);
//                         }
//                     })
//                 } catch (err) {
//                     console.error(`Error creating attribute '${attr.name}': ${err.message}`);
//                     sendMessage(ws, `Error creating attribute '${attr.name}', it may already exist.`);
//                     continue;
//                 }
//             }

//             // Handle terms for the attribute
//             const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${attributeId}/terms`);

//             for (const term of attr.values) {
//                 const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

//                 try {
//                     if (existingTerm) {
//                         // Term exists, update it
//                         await WooCommerceAPI.put(`products/attributes/${attributeId}/terms/${existingTerm.id}`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term '${term}' under attribute '${attr.name}' updated.`);
//                     } else {
//                         // Term doesn't exist, create it
//                         await WooCommerceAPI.post(`products/attributes/${attributeId}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term '${term}' under attribute '${attr.name}' created.`);
//                     }
//                 } catch (err) {
//                     console.error(`Error handling term '${term}' under attribute '${attr.name}': ${err.message}`);
//                     sendMessage(ws, `Error handling term '${term}' under attribute '${attr.name}'.`);
//                 }
//             }
//         }
//     } catch (err) {
//         console.error(`Error in addOrUpdateGlobalAttributes: ${err.message}`);
//         sendMessage(ws, 'An error occurred while updating global attributes.');
//     }
// }

//V3
async function addOrUpdateGlobalAttributes(ws) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });

    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        const attributesCollection = mongoose.connection.collection('product_attributes');
        const allAttributes = await attributesCollection.find({}).toArray();

        const existingAttributes = await fetchAllFromWooCommerce("products/attributes");

        for (const attr of allAttributes) {
            let attributeId;
            const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());

            if (existingAttribute) {
                // If attribute exists, update it
                const response = await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
                    name: attr.name,
                    slug: attr.name.toLowerCase(),
                    type: "select",
                    order_by: "menu_order",
                    has_archives: true,
                    is_variation: attr.variation
                });
                attributeId = response.data.id;
                await attributesCollection.updateOne({ _id: attr._id }, {
                    $set: {
                        woo_id: attributeId,
                        updatedAt: new Date().toISOString()
                    }
                });
                sendMessage(ws, `Attribute <strong>${attr.name}</strong> updated.`);
            } else {
                // If attribute doesn't exist, create it
                const response = await WooCommerceAPI.post("products/attributes", {
                    name: attr.name,
                    slug: attr.name.toLowerCase(),
                    type: "select",
                    order_by: "menu_order",
                    has_archives: true,
                    is_variation: attr.variation
                });
                attributeId = response.data.id;
                await attributesCollection.updateOne({ _id: attr._id }, {
                    $set: {
                        woo_id: attributeId,
                        updatedAt: new Date().toISOString()
                    }
                });
                sendMessage(ws, `Attribute <strong>${attr.name}</strong> created.`);
            }

            // Handle terms for the attribute
            const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${attributeId}/terms`);

            for (const term of attr.values) {
                const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

                if (existingTerm) {
                    // If term exists, update it
                    await WooCommerceAPI.put(`products/attributes/${attributeId}/terms/${existingTerm.id}`, {
                        name: term,
                        slug: term.toLowerCase()
                    });
                    sendMessage(ws, `-- Term <strong>${term}</strong> under attribute <strong>${attr.name}</strong> updated.`);
                } else {
                    // If term doesn't exist, create it
                    await WooCommerceAPI.post(`products/attributes/${attributeId}/terms`, {
                        name: term,
                        slug: term.toLowerCase()
                    });
                    sendMessage(ws, `-- Term <strong>${term}</strong> under attribute <strong>${attr.name}</strong> created.`);
                }
            }
        }
    } catch (err) {
        console.error(`Error in addOrUpdateGlobalAttributes: ${err.message}`);
        sendMessage(ws, 'All attributes exist on website, skipping...');
    } finally {
        await mongoose.connection.close();
    }
}

//V4
// async function addOrUpdateGlobalAttributes(ws) {
//     const WooCommerceAPI = new WooCommerceRestApi({
//         url: process.env.WP_DESTINATION_URL,
//         consumerKey: process.env.WC_CONSUMER_KEY,
//         consumerSecret: process.env.WC_CONSUMER_SECRET,
//         version: process.env.WC_API_VERSION,
//         queryStringAuth: true,
//     });

//     try {
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         const existingAttributes = await fetchAllFromWooCommerce("products/attributes");

//         for (const attr of allAttributes) {
//             let attributeId;
//             const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());

//             if (existingAttribute) {
//                 // If attribute exists, update it
//                 try {
//                     const response = await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
//                         name: attr.name,
//                         slug: attr.name.toLowerCase(),
//                         type: "select",
//                         order_by: "menu_order",
//                         has_archives: true,
//                         is_variation: attr.variation
//                     });
//                     attributeId = response.data.id;
//                 } catch (updateErr) {
//                     if (updateErr.response && updateErr.response.status === 400) {
//                         sendMessage(ws, `Attribute '${attr.name}' already exists.`);
//                     } else {
//                         throw updateErr;
//                     }
//                 }
//             } else {
//                 // If attribute doesn't exist, create it
//                 try {
//                     const response = await WooCommerceAPI.post("products/attributes", {
//                         name: attr.name,
//                         slug: attr.name.toLowerCase(),
//                         type: "select",
//                         order_by: "menu_order",
//                         has_archives: true,
//                         is_variation: attr.variation
//                     });
//                     attributeId = response.data.id;
//                 } catch (createErr) {
//                     if (createErr.response && createErr.response.status === 400) {
//                         sendMessage(ws, `Attribute '${attr.name}' already exists.`);
//                     } else {
//                         throw createErr;
//                     }
//                 }
//             }

//             if (attributeId) {
//                 await attributesCollection.updateOne({ _id: attr._id }, {
//                     $set: {
//                         woo_id: attributeId,
//                         updatedAt: new Date().toISOString()
//                     }
//                 });
//                 sendMessage(ws, `Attribute '${attr.name}' processed.`);
//             }

//             // Handle terms for the attribute
//             const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${attributeId}/terms`);

//             for (const term of attr.values) {
//                 const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

//                 if (existingTerm) {
//                     // If term exists, update it
//                     await WooCommerceAPI.put(`products/attributes/${attributeId}/terms/${existingTerm.id}`, {
//                         name: term,
//                         slug: term.toLowerCase()
//                     });
//                     sendMessage(ws, `Term '${term}' under attribute '${attr.name}' updated.`);
//                 } else {
//                     // If term doesn't exist, create it
//                     try {
//                         await WooCommerceAPI.post(`products/attributes/${attributeId}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                         sendMessage(ws, `Term '${term}' under attribute '${attr.name}' created.`);
//                     } catch (err) {
//                         if (err.response && err.response.status === 400) {
//                             sendMessage(ws, `Term '${term}' under attribute '${attr.name}' already exists.`);
//                         } else {
//                             throw err;
//                         }
//                     }
//                 }
//             }
//         }
//     } catch (err) {
//         console.error(`Error in addOrUpdateGlobalAttributes: ${err.message}`);
//         sendMessage(ws, 'An error occurred while updating global attributes.');
//     }
//     //  finally {
//     //     await mongoose.connection.close();
//     // }
// }



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

        const parentProducts = allProducts.filter(product => product["Type"] === "variable");
        const variations = allProducts.filter(product => product["Type"] === "variation");

        // console.log(variations);
        // return;

        for (const parentProduct of parentProducts) {
            const mappedParentProduct = await mapProductToWooFormat(parentProduct, allAttributes, categoriesCollection);

            // console.log(mappedParentProduct)
            mappedParentProduct.variations = [];

            for (const variation of variations) {
                // console.log(variation)
                if (variation["Parent SKU"] === parentProduct["SKU"]) {
                    const mappedVariation = await mapProductToWooFormat(variation, allAttributes, categoriesCollection);

                    // console.log(mappedVariation)

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

        // console.log(finalMappedProducts)
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

const mappedProductSchema = new mongoose.Schema({
    sku: { type: String, required: true, unique: true, index: true },
    name: String,
    slug: String,
    date_created: String,
    date_created_gmt: String,
    date_modified: String,
    date_modified_gmt: String,
    status: String,
    featured: Boolean,
    catalog_visibility: String,
    description: String,
    parent_sku: String,
    type: String,
    price: String,
    regular_price: String,
    trade_price: String,
    attributes: Array,
    downloadable: Boolean,
    downloads: Array,
    images: Array,
    categories: Array,
    tags: Array,
    meta_data: Array,
    variations: Array,
    woo_id: {
        type: Number,
        index: true,
    },
    createdAt: { type: Date, default: Date.now, immutable: true },
    lastModified: { type: Date, default: Date.now }
});
// Update lastModified when product data changes
mappedProductSchema.pre('save', function (next) {
    if (this.isModified('woo_id') && this.woo_id === null) {
        // Reset woo_id to its original value if it's being set to null
        this.constructor.findOne({ _id: this._id }, (err, originalDoc) => {
            if (err) {
                next(err);
            } else {
                this.woo_id = originalDoc.woo_id;
                next();
            }
        });
    } else {
        this.lastModified = new Date();
        next();
    }
    this.lastModified = new Date();
    next();
});
// mappedProductSchema.pre('save', function (next) {
//     if (this.isModified('woo_id') && this.woo_id === null) {
//         // Reset woo_id to its original value if it's being set to null
//         this.constructor.findOne({ _id: this._id }, (err, originalDoc) => {
//             if (err) {
//                 next(err);
//             } else {
//                 this.woo_id = originalDoc.woo_id;
//                 next();
//             }
//         });
//     } else {
//         next();
//     }
// });

const MappedProduct = mongoose.model('MappedProduct', mappedProductSchema, 'mappedProducts');


async function mapProductToWooFormat(product, allAttributes, categoriesCollection) {

    // console.log(allAttributes)

    const getCategoryWooId = async (categoryName) => {
        const categoryDoc = await categoriesCollection.findOne({ name: categoryName });
        return categoryDoc ? categoryDoc.woo_id : null;
    };

    const wooCategoryIds = await Promise.all(product["Category"].map(getCategoryWooId));

    // console.log(product)
    // return

    // const productSku = product["SKU"]
    // const wooProduct = await checkToSeeIfSKUexists(productSku);

    // const wooId = wooProduct.id


    return {
        name: product["Product Title"],
        slug: product["Product Title"].toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'),
        date_created: new Date().toISOString(),
        date_created_gmt: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        date_modified_gmt: new Date().toISOString(),
        status: "publish",
        featured: false,
        catalog_visibility: "visible",
        description: product["Description"],
        sku: product["SKU"],
        parent_sku: product["Parent SKU"] ? product["Parent SKU"] : '',
        type: product["Type"] === "variable" ? "variable" : "variation",
        price: product["Trade Price"] ? product["Trade Price"].toString() : "0",
        regular_price: product["Trade Price"] ? product["Trade Price"].toString() : "0",
        trade_price: product["Platinum Price (-50%)"] ? product["Platinum Price (-50%)"].toString() : product["Trade Price"],
        attributes: allAttributes.reduce((acc, attribute) => {
            if (product[attribute.name]) {
                acc.push({
                    id: attribute.woo_id,
                    name: attribute.name,
                    variation: attribute.variation,
                    option: product[attribute.name].map(item => item.values).flat()
                });
            }
            return acc;
        }, []),
        downloadable: product["Datasheet"] || product["Instruction Manual"] || product["Photometry"] || product["CAD Drawings"] ? true : false,
        downloads: [
            ...product["Datasheet"] ? [{ name: "Datasheet", file: product["Datasheet"].toString() }] : [],
            ...product["Instruction Manual"] ? [{ name: "Instruction Manual", file: product["Instruction Manual"].toString() }] : [],
            ...product["Photometry"] ? [{ name: "Photometry", file: product["Photometry"].toString() }] : [],
            ...product["CAD Drawings"] ? [{ name: "CAD Drawings", file: product["CAD Drawings"].toString() }] : []
        ],

        images: product["Image URL"].map((url, index) => ({
            src: url,
            name: url.split('/').pop()
        })),
        categories: wooCategoryIds.map(id => ({ id })),
        tags: product["Tags"].map(tagName => ({
            name: tagName
        })),
        meta_data: [
            {
                key: "_download_expiry",
                value: "1"
            },
            {
                key: "_download_limit",
                value: "1"
            },
            {
                key: "_download_type",
                value: "standard"
            },
            {
                key: "_sold_individually",
                value: "yes"
            },
        ],
        variations: [],
        // woo_id: wooId
    };
}


async function saveCategoriesToWooCommerce() {
    // 1. Connect to MongoDB and fetch csvProductData

    // Connect to MongoDB
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const csvProductData = mongoose.connection.collection('csvProductData');
    const allCategories = await csvProductData.find({}).toArray();


    // Get product categproes from WooCommerce

    const wooCats = await fetchAllFromWooCommerce("products/categories");

    if (wooCats.length > 0) return

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

// Fetch Media from WooCommerce
async function fetchMediaFromWooCommerce() {
    const mediaResponse = await fetch(`${process.env.WP_DESTINATION_URL}/wp-json/wp/v2/media`);
    return await mediaResponse.json();
}

function getImageId(imageUrl, media) {
    if (!imageUrl) return null;
    const imageFilename = imageUrl.split('/').pop();
    const existingMedia = media.find(m => m.source_url.endsWith(imageFilename));
    return existingMedia ? existingMedia.id : null;
}

function getVariationImageId(imageName, media) {
    const existingMedia = media.find(m => m.title.rendered === imageName);
    return existingMedia ? existingMedia.id : null;
}

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




// :: HELPER FUNCTIONS::

// Seperate Variables and Variations
function separateProductsAndVariations(mappedProducts) {
    const variableProducts = mappedProducts.filter(p => p.type === "variable");
    const variations = mappedProducts.filter(p => p.type === "variation");
    return { variableProducts, variations };
}

// Chunk Up your life.
function chunkArray(array, chunkSize) {
    const testChunks = false
    const chunks = [];

    // console.log(typeof testChunks);
    if (testChunks === true) {
        const limitedArray = array.slice(0, 20);
        for (let i = 0; i < limitedArray.length; i += chunkSize) {
            chunks.push(limitedArray.slice(i, i + chunkSize));
        }

    } else {
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
    }

    return chunks;
}

// Does SKU Exist in WooCommerce?
async function checkToSeeIfParentSKUexists(productSku) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });

    const wooProduct = await WooCommerceAPI.get(`products?sku=${productSku}`);
    // console.log(wooProduct)
    try {

        // console.log(wooProduct.data[0].id);
        return {
            existsInWoo: true,
            id: wooProduct.data[0].id,
            sku: productSku
        }
    } catch (err) {
        // console.log(err.message)
        return {
            existsInWoo: false,
            sku: productSku
        }
    }
}

async function checkToSeeIfVariationSKUexists(productSku, parentId) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });

    // console.log('PASSED ParentID: ', parentId)
    // console.log('PRODUCT SKU:', productSku)
    const wooProduct = await WooCommerceAPI.get(`products/${parentId}/variations?sku=${productSku}`);
    try {
        return {
            existsInWoo: true,
            id: wooProduct.data[0].id,
            parent_id: parentId,
            sku: productSku
        }
    } catch (err) {
        // console.log(err.message)
        return {
            existsInWoo: false,
            sku: productSku
        }
    }
}

// Does WooID exist in DB?
async function checkToSeeIfWOOIDinDB(wooId, sku) {

    try {
        const existingProduct = await MappedProduct.findOne({ woo_id: wooId });
        if (!existingProduct) {

            const res = await MappedProduct.findOneAndUpdate(
                { sku: sku },
                { $set: { woo_id: wooId } },
                { new: true, upsert: true }
            );

            // console.log(res)

            return {
                existsInDB: 'updated',
                sku: sku,
                woo_id: res.woo_id,
                message: `Woo ID: ${res.woo_id} now exists on SKU: ${sku}`
            }

        } else {
            return {
                existsInDB: true,
                sku: existingProduct.sku,
                woo_id: existingProduct.woo_id,
                message: `Woo ID: ${existingProduct.woo_id} already exists on SKU: ${existingProduct.sku}`
            }
        }
    } catch (err) {
        console.log(err.message)

        // const res = await MappedProduct.findOneAndUpdate(
        //     { sku: sku },
        //     { $set: { woo_id: wooId } },
        //     { new: true, upsert: true }
        // );

        return {
            existsInDB: 'error',
            sku: sku,
            woo_id: wooId,
            message: `An error occured: ${err.message}`
            // message: `Woo ID: ${wooId} does not exist with SKU: ${sku} so this has now been updated. ${res.woo_id}`
        }
    }

}

// Has product data changed? (Could use a rework)
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
// Part of the isProductDataChanged() function
function areAttributesEqual(newAttributes, currentAttributes) {
    // Compare the attributes arrays
    // You can add more complex comparison logic here if needed
    return JSON.stringify(newAttributes) === JSON.stringify(currentAttributes);
}
function areDownloadsEqual(newDownloads, currentDownloads) {
    // Compare the downloads arrays
    return JSON.stringify(newDownloads) === JSON.stringify(currentDownloads);
}
function areImagesEqual(newImage, currentImage) {
    // Compare the image objects
    // This assumes images are compared based on an ID or src attribute
    return JSON.stringify(newImage) === JSON.stringify(currentImage);
}

// :: HELPER FUNCTIONS::


// :: DATA PREPORATION ::
// Prepares the Variable Product Data into the pushProductsToWooCommerce structure (Note, Might need further refactoring to use Schema)
function prepareParentProductData(variableProducts) {

    // console.log(variableProducts)

    return variableProducts.map(product => ({
        name: product.name,
        slug: product.slug,
        type: product.type,
        status: product.status,
        description: product.description,
        sku: product.sku,
        price: product.price,
        regular_price: product.regular_price,
        attributes: product.attributes.map(attr => ({
            id: attr.id,
            name: attr.name,
            visible: true,
            variation: attr.variation,
            options: attr.option
        })),
        downloads: product.downloads,
        images: product.images,
        categories: product.categories,
        tags: product.tags,
        woo_id: product.woo_id
    }));
}
// Prepares Variation Product Data (Not sure if actually Needed)
function prepareVariationData(variationProducts, parentId) {
    return variationProducts.map(product => ({
        parent_id: parentId,
        regular_price: product.regular_price,
        attributes: product.attributes.map(attr => ({
            id: attr.id,
            option: attr.option[0]
        })),
        downloadable: product.downloadable,
        downloads: product.downloads.map(download => ({
            name: download.name,
            file: download.file
        })),
        sku: product.sku,
        parent_sku: product.parent_sku,
        height: product.height,
        width: product.width,
        length: product.length,
        description: product.description,
        image: product.image_id ? { id: product.image_id } : null,
        woo_id: product.woo_id
    }));
}


// :: MAIN FUNCTION for Parent Product integration
// Upload the Parent Products
async function uploadParentProducts(ws, variableProducts) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });

    const parentProductsData = prepareParentProductData(variableProducts);
    let productDataPush = {
        create: [],
        update: []
    }
    let allIds = [];
    let allSkus = [];

    for (const product of parentProductsData) {
        const existsProduct = await checkToSeeIfParentSKUexists(product.sku) // Function to check WOOCommerce with SKU. Returns id if successful
        if (false === existsProduct.existsInWoo) {
            sendMessage(ws, `<strong>CREATE: </strong> SKU: <strong>${existsProduct.sku}</strong> Does not exist adding to create array`)
            // Send off to be created
            productDataPush.create.push(product);
        } else if (true === existsProduct.existsInWoo) {
            sendMessage(ws, `<strong>INFO: </strong> SKU: <strong>${existsProduct.sku}</strong> exists with ID: <strong>${existsProduct.id}</strong>`)
            const existsInDBandWoo = await checkToSeeIfWOOIDinDB(existsProduct.id, existsProduct.sku);
            if (existsInDBandWoo) {
                // Fetch current product data from WooCommerce
                const currentProductResponse = await WooCommerceAPI.get(`products/${existsInDBandWoo.woo_id}`);
                const currentProduct = currentProductResponse.data;
                const dataChanged = isProductDataChanged(product, currentProduct);
                if (dataChanged) {
                    sendMessage(ws, `<strong>UPDATE: </strong> Updating product with SKU: <strong>${product.sku}</strong>`);
                    productDataPush.update.push({ id: existsInDBandWoo.woo_id, ...product });
                }
            }
        }

    }

    const totalCreates = productDataPush.create.length;
    const totalUpdates = productDataPush.update.length;
    const maxBatchSize = 100;

    // Calculate proportion of create and update operations
    const proportion = totalCreates / (totalCreates + totalUpdates);

    // Allocate chunk size based on proportion, ensuring the total is not more than 100
    const chunkSizeCreate = Math.min(Math.floor(maxBatchSize * proportion), totalCreates);
    const chunkSizeUpdate = Math.min(maxBatchSize - chunkSizeCreate, totalUpdates);

    let chunkedCreateData = chunkArray(productDataPush.create, chunkSizeCreate);
    let chunkedUpdateData = chunkArray(productDataPush.update, chunkSizeUpdate);

    // console.log(chunkedCreateData)
    // console.log('------------------------')
    // console.log(chunkedUpdateData)

    let maxChunks = Math.max(chunkedCreateData.length, chunkedUpdateData.length);

    let createLength = 0;
    let updateLength = 0
    for (let i = 0; i < maxChunks; i++) {
        let createChunk = chunkedCreateData[i] || [];
        let updateChunk = chunkedUpdateData[i] || [];

        const data = {
            create: createChunk,
            update: updateChunk
        }

        await WooCommerceAPI.post("products/batch", data)
            .then(async (response) => {
                if (response.data.create && response.data.create.length > 0) {
                    for (const product of response.data.create) {
                        await MappedProduct.findOneAndUpdate({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
                        allIds.push(product.id);
                        allSkus.push(product.sku);
                        createLength++
                    }
                }
                if (response.data.update && response.data.update.length > 0) {
                    for (const product of response.data.update) {
                        await MappedProduct.findOneAndUpdate({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
                        allIds.push(product.id);
                        allSkus.push(product.sku);
                        updateLength++
                    }
                }
            })
            .catch((err) => {
                console.log(err.message);
            });
    }

    sendMessage(ws, `---Processed a batch of <strong>${createLength}</strong> parent product creations and <strong>${updateLength}</strong> parent product updates---`);
    return { wooParentIds: allIds, wooParentSkus: allSkus };
}
// ::WIP - Works and pushes data. A bit slow though.
async function uploadVariations(ws, variations, wooParentSkus, wooParentIds) {
    const WooCommerceAPI = new WooCommerceRestApi({
        url: process.env.WP_DESTINATION_URL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        version: process.env.WC_API_VERSION,
        queryStringAuth: true,
    });


    let productDataPush = {
        create: [],
        update: []
    }
    let allVariationIds = [];
    let allVariationSkus = [];

    // console.log(variations)

    // for (let i = 0; i < wooParentIds.length; i++) {
    //     let parentId = wooParentIds[i];
    //     console.log(parentId)
    // }

    // return;


    for (let i = 0; i < wooParentSkus.length; i++) {
        let parentId = wooParentIds[i];
        const parentSku = wooParentSkus[i];
        const childVariations = variations.filter(v => v.parent_sku === wooParentSkus[i]);
        // Check and fetch parentId if missing
        if (!parentId) {
            const existsParent = await checkToSeeIfParentSKUexists(parentSku)
            if (!existsParent.existsInWoo) {
                sendMessage(ws, `<strong>ERROR: </strong> Parent product with SKU: <strong>${parentSku}</strong> not found in WooCommerce... continuing.`);
                continue;
            }
        }

        const theVars = prepareVariationData(childVariations, parentId);

        // console.log("----THEVARS---")
        // console.log(theVars)
        // return


        for (const variation of theVars) {
            // console.log(variation)
            // return
            const existsProduct = await checkToSeeIfVariationSKUexists(variation.sku, variation.parent_id) // Function to check WOOCommerce with SKU. Returns id if successful
            variation.parent_id = parentId; // Directly associate with its parent ID

            // console.log('--------VARIATION CHECKING--------')
            // console.table(existsProduct)
            // console.log('------------------------')
            // return
            if (false === existsProduct.existsInWoo) {
                sendMessage(ws, `<strong>CREATE: </strong> SKU: <strong>${existsProduct.sku}</strong> does not exist`)
                // Send off to be created
                productDataPush.create.push(variation);
            } else if (true === existsProduct.existsInWoo) {
                sendMessage(ws, `<strong>INFO: </strong> SKU: <strong>${existsProduct.sku}</strong> exists with ID: <strong>${existsProduct.id}</strong>`)
                // console.log(existsProduct)
                // return
                const existsInDBandWoo = await checkToSeeIfWOOIDinDB(existsProduct.id, existsProduct.sku);
                if (existsInDBandWoo) {
                    // Fetch current product data from WooCommerce
                    const currentProductResponse = await WooCommerceAPI.get(`products/${parentId}/variations/${existsInDBandWoo.woo_id}`);
                    const currentProduct = currentProductResponse.data;

                    const dataChanged = isProductDataChanged(variation, currentProduct);
                    if (dataChanged) {
                        sendMessage(ws, `<strong>UPDATE: </strong> Updating product with SKU: <strong>${variation.sku}</strong> `);
                        productDataPush.update.push({ id: existsInDBandWoo.woo_id, ...variation });
                    }
                }
            }
        }
    }

    const totalCreates = productDataPush.create.length;
    const totalUpdates = productDataPush.update.length;
    const maxBatchSize = 100;

    // Calculate proportion of create and update operations
    const proportion = totalCreates / (totalCreates + totalUpdates);

    // Allocate chunk size based on proportion, ensuring the total is not more than 100
    const chunkSizeCreate = Math.min(Math.floor(maxBatchSize * proportion), totalCreates);
    const chunkSizeUpdate = Math.min(maxBatchSize - chunkSizeCreate, totalUpdates);

    let chunkedCreateData = chunkArray(productDataPush.create, chunkSizeCreate);
    let chunkedUpdateData = chunkArray(productDataPush.update, chunkSizeUpdate);

    let maxChunks = Math.max(chunkedCreateData.length, chunkedUpdateData.length);
    for (let i = 0; i < maxChunks; i++) {
        let createChunk = chunkedCreateData[i] || [];
        let updateChunk = chunkedUpdateData[i] || [];
        let parentId = createChunk.length > 0 ? createChunk[0].parent_id : updateChunk.length > 0 ? updateChunk[0].parent_id : null;

        if (!parentId) continue; // Skip if parentId is not found
        const data = {
            create: createChunk,
            update: updateChunk
        }


        await WooCommerceAPI.post(`products/${parentId}/variations/batch`, data)
            .then(async (response) => {


                if (response.data.create && response.data.create.length > 0) {
                    // console.log(response.data)
                    for (const product of response.data.create) {
                        await MappedProduct.findOneAndUpdate({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
                        allVariationIds.push(product.id);
                        allVariationSkus.push(product.sku);
                    }
                }
                if (response.data.update && response.data.update.length > 0) {

                    // console.log(response.data)
                    for (const product of response.data.update) {
                        await MappedProduct.findOneAndUpdate({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
                        allVariationIds.push(product.id);
                        allVariationSkus.push(product.sku);
                    }
                }
            })
            .catch((err) => {
                console.log(err);
            });


        sendMessage(ws, `---Processed a batch of <strong>${createChunk.length}</strong> variation creates and <strong>${updateChunk.length}</strong> variation updates---`);
    }

    return { wooVariationIds: allVariationIds, wooVariationSkus: allVariationSkus };
}

// WooCommerce Process function
async function pushProductsToWooCommerce(ws, mappedProducts) {
    try {
        const media = await fetchMediaFromWooCommerce();
        const mProducts = modifyMappedProductsWithMedia(mappedProducts, media);

        // if (mProducts.woo_id != null) {
        //     console.log(mProducts.woo_id)
        // }
        // // console.log(mProducts);
        // return
        const { variableProducts, variations } = separateProductsAndVariations(mProducts);

        sendMessage(ws, '== Process Variables on website ==')
        const { wooParentIds, wooParentSkus } = await uploadParentProducts(ws, variableProducts);

        // console.log(wooParentIds)
        // console.log(wooParentSkus)

        sendMessage(ws, '== Process Variations on website ==')

        const { wooVariationIds, wooVariationSkus } = await uploadVariations(ws, variations, wooParentSkus, wooParentIds);

        // console.log(wooVariationSkus);
        // return
        const parentProductsLength = wooParentSkus.length;
        const variationProductsLength = wooVariationSkus.length;
        // console.log(`Successfully pushed ${parentProductsLength} Parent Products and their ${variationProductsLength} variations to WooCommerce`);
        sendMessage(ws, `<strong>!!!!!Successfully pushed ${parentProductsLength} Parent Products and their ${variationProductsLength} variations to WooCommerce!!!!</strong>`);
    } catch (error) {
        console.error("Error pushing products to WooCommerce:", error);
        sendMessage(ws, `Error pushing products to WooCommerce: ${error}`);
    }
}


// Helper function to get parent product ID from SKU
// async function getParentIdFromSku(sku) {
//     const WooCommerceAPI = new WooCommerceRestApi({
//         url: process.env.WP_DESTINATION_URL,
//         consumerKey: process.env.WC_CONSUMER_KEY,
//         consumerSecret: process.env.WC_CONSUMER_SECRET,
//         version: process.env.WC_API_VERSION,
//         queryStringAuth: true,
//     });
//     try {
//         const response = await WooCommerceAPI.get(`products`, { sku: sku });
//         if (response.data && response.data.length > 0) {
//             return response.data[0].id; // Assuming the first product is the correct one
//         }
//         return null;
//     } catch (error) {
//         console.error(`Error fetching product by SKU: ${sku} `, error);
//         return null;
//     }
// }


// Let the Process Start
async function processBuilder(ws) {
    const startTime = Date.now();
    ws.send("startTimer");

    try {
        await sleep(delayTimeout);
        sendMessage(ws, "<strong>====INITIATE CSV TO WOOCOMMERCE IMPORT====</strong>")
        await sleep(delayTimeout);
        await convertCSVToMongo(ws);

        await sleep(delayTimeout);
        sendMessage(ws, "<strong>====EXTRACTING ATTRIBUTES TO DATABASE====</strong>")
        await extractAttributes(ws)

        await sleep(delayTimeout);
        sendMessage(ws, "<strong>====EXTRACT AND CREATE CATEGORIES IN WOOCOMMERCE====</strong>")
        await saveCategoriesToWooCommerce()

        await sleep(delayTimeout)
        sendMessage(ws, "<strong>====ADDING GLOBAL ATTRIBUTES TO WOOCOMMERCE====</strong>")
        await addOrUpdateGlobalAttributes(ws)

        await sleep(delayTimeout);
        sendMessage(ws, "<STRONG>====MAPPING PRODUCTS FOR WOOCOMMERCE====</STRONG>");
        const mappedProducts = await mapProductsForWooCommerce(ws);
        // console.log(mappedProducts)
        await sleep(delayTimeout)
        sendMessage(ws, "<STRONG>====PUSHING PRODUCTS TO WOOCOMMERCE====</STRONG>");
        await pushProductsToWooCommerce(ws, mappedProducts);

        sendMessage(ws, "<strong>====PROCESS COMPLETE====</strong>")
    } catch (err) {
        console.log('Error:', err);
    }

    const endTime = Date.now();
    const elapsedTime = (endTime - startTime);

    const hours = Math.floor(elapsedTime / 3600000);
    const minutes = Math.floor((elapsedTime - (hours * 3600000)) / 60000);
    const seconds = Math.floor((elapsedTime - (hours * 3600000) - (minutes * 60000)) / 1000);

    sendMessage(ws, `Elapsed time: ${hours} hours, ${minutes} minutes, ${seconds} seconds`);

    // Stop the timer on client side
    ws.send("stopTimer");
}


module.exports = { processBuilder };
