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
const WooCommerceAPI = new WooCommerceRestApi({
    url: process.env.WP_DESTINATION_URL,
    consumerKey: process.env.WC_CONSUMER_KEY,
    consumerSecret: process.env.WC_CONSUMER_SECRET,
    version: process.env.WC_API_VERSION,
    queryStringAuth: true,
});

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




// Function to convert CSV to MongoDB (USED AND WORKS)
async function convertCSVToMongo(ws) {
    const csvFilePath = './csv_data/tubular-data-actual.csv';
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
                    // console.log(attribute, attrVal)
                    if (!attributeCache[attribute]) {
                        // Fetch attribute from database if not in cache
                        const existingAttribute = await attributes.findOne({ name: attribute });
                        attributeCache[attribute] = existingAttribute ? new Set(existingAttribute.values) : new Set();

                        // If it doesn't exist in the database, create it
                        if (!existingAttribute) {
                            await attributes.insertOne({
                                name: attribute,
                                slug: `pa_${attribute.toLowerCase().replace(/\s+/g, '-')}`,
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
                                $set: { slug: `pa_${attribute.toLowerCase().replace(/\s+/g, '-')}` },
                                $push: {
                                    values: attrVal,
                                }
                            }, {
                            upsert: true
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


// CRUD (Without the D) Global Attributes to WooCommerce
async function addOrUpdateGlobalAttributes(ws) {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const existingTerms = await checkToSeeIfAttributeAndTermExists()

    for (const attribute of existingTerms) {

        // console.log(attribute)

        if (attribute.status === false) {
            try {
                await WooCommerceAPI.post("products/attributes", {
                    name: attribute.name,
                    slug: attribute.slug,
                    type: "select",
                    order_by: "menu_order",
                    has_archives: true,
                    // is_variation: attribute.variation
                }).then(async (response) => {

                    const attributesCollection = mongoose.connection.collection('product_attributes');
                    await attributesCollection.findOneAndUpdate({ _id: attribute.dbId }, {
                        $set: {
                            woo_id: response.data.id,
                            updatedAt: new Date().toISOString()
                        }
                    }, { upsert: true }).then(async (result) => {
                        // console.log(result);
                        sendMessage(ws, `Attribute <strong>${attribute.name}</strong> created.`);

                        // Create terms
                        for (const term of attribute.terms) {
                            await WooCommerceAPI.post(`products/attributes/${response.data.id}/terms`, {
                                name: term.term_item.name,
                                slug: term.term_item.name.toLowerCase().replace(/\s+/g, '-')
                            }).then(async (response) => {
                                // console.log(response);
                                // sendMessage(ws, `Term <strong>${term.term_item.name}</strong> created`)
                                sendMessage(ws, `-- Term <strong>${term.term_item.name}</strong> created under attribute <strong>${attribute.name}</strong>.`);
                            }).catch((err) => {
                                console.log(err.response.data);
                                sendMessage(ws, `-- Term <strong>${term.term_item.name}</strong> already exists, skipping`)
                            })
                        }
                    }).catch((err) => {
                        console.log(err);
                    });

                }).catch((err) => {
                    console.log(err.response.data.message);
                    // sendMessage(ws, `Attribute <strong>${attribute.name}</strong> already exists, skipping`)
                })

            } catch (err) {
                console.log(err.message)
            }
        }

        // console.log(attribute.terms)
        // return
        if (attribute.status === true) {
            for (const term of attribute.terms) {
                // console.log(term)

                if (term.exists === false) {
                    try {
                        await WooCommerceAPI.post(`products/attributes/${attribute.woocommerceId}/terms`, {
                            name: term.term_item.name,
                            // slug: term.term_item.name.toLowerCase().replace(/\s+/g, '-')
                        }).then(async (response) => {
                            // console.log(response);
                            // sendMessage(ws, `Term <strong>${term.name}</strong> created`)
                            sendMessage(ws, `-- Term <strong>${term.term_item.name}</strong> created under attribute <strong>${attribute.name}</strong>.`);
                        }).catch((err) => {
                            console.log(err.response.data.message);
                            sendMessage(ws, `-- Term <strong>${term.term_item.name}</strong> already exists, skipping`)
                        })
                    } catch (err) {
                        console.log(err.message)
                    }
                }
            }
        }


    }

    // FUTURE PLANS :: Delete any terms in WooCommerce that don't exist in the database
    //  for (const existingTerm of existingTerms) {
    //      if (!attr.values.includes(existingTerm.name)) {
    //          try {
    //              await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`);
    //          } catch (err) {
    //              console.error(`Error deleting term "${existingTerm.name}": ${err.message}`);
    //          }
    //      }
    //  }

}



// Map Products for WooCommerce
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

// WORKS A bit tempermental
// async function saveCategoriesToWooCommerce() {
//     // 1. Connect to MongoDB and fetch csvProductData

//     // Connect to MongoDB
//     await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//     const csvProductData = mongoose.connection.collection('csvProductData');
//     const allCategories = await csvProductData.find({}).toArray();


//     // Get product categproes from WooCommerce

//     const wooCats = await fetchAllFromWooCommerce("products/categories");

//     if (wooCats.length > 0) return

//     // const client = await MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//     // const db = client.db('YOUR_DB_NAME');
//     // const csvProductData = await db.collection('csvProductData').find({}).toArray();

//     // 2. Extract unique categories
//     const uniqueCategories = [...new Set(allCategories.flatMap(product => product.Category))];

//     // 3. Save unique categories to product_categories collection
//     const categoriesToInsert = uniqueCategories.map(category => ({ name: category }));
//     await mongoose.connection.collection('product_categories').insertMany(categoriesToInsert);

//     // 4. POST categories to WooCommerce and get woo_id
//     for (let category of categoriesToInsert) {
//         const WooCommerceAPI = new WooCommerceRestApi({
//             url: process.env.WP_DESTINATION_URL,
//             consumerKey: process.env.WC_CONSUMER_KEY,
//             consumerSecret: process.env.WC_CONSUMER_SECRET,
//             version: process.env.WC_API_VERSION,
//             queryStringAuth: true,
//         });
//         const response = await WooCommerceAPI.post('products/categories', { name: category.name });
//         const woo_id = response.data.id;

//         // 5. Update product_categories collection with woo_id
//         await mongoose.connection.collection('product_categories').updateOne({ name: category.name }, {
//             $set: {
//                 woo_id: woo_id,
//                 updatedAt: new Date().toISOString()
//             }
//         });
//     }

//     mongoose.connection.close();
// }


//NEW
// async function saveCategoriesToWooCommerce() {

//     // RABBIT WARREN - AMAZING PIECE OF KIT BUT NOT FOR THIS PROJECT
//     // const allCategories = await csvProductData.aggregate([
//     //     {
//     //         $match: {
//     //             Category: { $exists: true, $ne: [], $not: { $size: 1, $in: [""] } }
//     //         }
//     //     },
//     //     {
//     //         $project: {
//     //             categoryData: {
//     //                 $cond: {
//     //                     if: { $isArray: "$Category" },
//     //                     then: { $arrayElemAt: ["$Category", 0] },
//     //                     else: "$Category"
//     //                 }
//     //             }
//     //         }
//     //     },
//     //     {
//     //         $project: {
//     //             categoryGroups: {
//     //                 $split: ["$categoryData", "|"]
//     //             }
//     //         }
//     //     },
//     //     {
//     //         $unwind: "$categoryGroups"
//     //     },
//     //     {
//     //         $project: {
//     //             subCategories: {
//     //                 $split: ["$categoryGroups", ">"]
//     //             }
//     //         }
//     //     },
//     //     {
//     //         $unwind: {
//     //             path: "$subCategories",
//     //             includeArrayIndex: "subCategoryIndex"
//     //         }
//     //     },
//     //     {
//     //         $group: {
//     //             _id: "$subCategories",
//     //             categories: { $push: "$$ROOT" }
//     //         }
//     //     }
//     // ]).toArray();



//     // 1. Connect to MongoDB and fetch csvProductData
//     try {
//         // Connect to MongoDB
//         // await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//         // const csvProductData = mongoose.connection.collection('csvProductData');

//         // Shake the tree and get the Categories
//         // const allCategories = await csvProductData.aggregate([
//         //     {
//         //         $match: {
//         //             Category: { $exists: true, $ne: [], $not: { $size: 1, $in: [""] } } // Filters out documents with empty or non-existent Category arrays
//         //         }
//         //     },
//         //     {
//         //         $project: {
//         //             _id: 0, // Excludes the _id field from the result
//         //             Category: 1 // Includes the Category field
//         //         }
//         //     }
//         // ]).toArray();

//         // const existingCategories = await fetchAllFromWooCommerce("products/categories");

//         // console.log(existingCategories)
//         // console.log(allCategories)

//         // // const existingCategoriesMap = existingCategories.reduce((map, cat) => {
//         // //     const slugWithoutPrefix = 'category'; //.replace(/^pa_/, '').toLowerCase()
//         // //     map[slugWithoutPrefix] = cat;
//         // //     return map;
//         // // }, {})

//         // // Array to store the comparison results

//         // // console.log(existingCategoriesMap)

//         // const comparisonResults = [];
//         // for (const cat of allCategories) {

//         //     for (const catItem of cat.Category) {
//         //         console.log(catItem)
//         //     }


//         //     // const catSlug = cat.slug.toLowerCase();
//         //     // let catibuteResult = {
//         //     //     status: false,
//         //     //     name: cat.name,
//         //     //     woocommerceId: null,
//         //     //     dbId: cat._id,
//         //     //     slug: catSlug,
//         //     //     terms: []
//         //     // };

//         //     // if (existingAttributesMap[attrSlug]) {}
//         // }





//         // // console.log(allCategories)
//         // return

//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//         const csvProductData = mongoose.connection.collection('csvProductData');
//         const allCategories = await csvProductData.find({}).toArray();
//         const wooCats = await fetchAllFromWooCommerce("products/categories");

//         if (wooCats.length > 0) return

//         // console.log(`WooCats: `, wooCats)
//         // return
//         // const client = await MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//         // const db = client.db('YOUR_DB_NAME');
//         // const csvProductData = await db.collection('csvProductData').find({}).toArray();

//         // 2. Extract unique categories
//         const uniqueCategories = [...new Set(allCategories.flatMap(product => product.Category))];

//         // 3. Save unique categories to product_categories collection
//         const categoriesToInsert = uniqueCategories.map(category => ({ name: category }));
//         await mongoose.connection.collection('product_categories').insertMany(categoriesToInsert);


//         console.log(categoriesToInsert)
//         return

//         // 4. POST categories to WooCommerce and get woo_id
//         for (const category of categoriesToInsert) {
//             await WooCommerceAPI.post('products/categories', { name: category.name }).then(async (response) => {
//                 sendMessage(ws, `Category <strong>${category.name}</strong> created.`)
//                 const woo_id = response.data.id;

//                 // 5. Update product_categories collection with woo_id
//                 await mongoose.connection.collection('product_categories').updateOne({ name: category.name }, {
//                     $set: {
//                         woo_id: woo_id,
//                         updatedAt: new Date().toISOString()
//                     }
//                 });
//             }).catch((err) => {
//                 console.log(err.response.data.message);
//                 sendMessage(ws, `Category <strong>${category.name}</strong> already exists, skipping`)
//             });
//         }

//     } catch (err) {
//         console.log(err);
//     };
// }

// Fetch Media from WooCommerce

async function saveCategoriesToWooCommerce() {
    // 1. Connect to MongoDB and fetch csvProductData
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const csvProductData = mongoose.connection.collection('csvProductData');
    const allCategories = await csvProductData.find({}).toArray();

    // Get product categories from WooCommerce
    const wooCats = await fetchAllFromWooCommerce("products/categories");

    if (wooCats.length > 0) return;

    // 2. Extract unique categories, filtering out empty or null values
    const uniqueCategories = [...new Set(allCategories.flatMap(product => product.Category).filter(category => category && category.trim() !== ''))];

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

    // mongoose.connection.close();
}


async function fetchMediaFromWooCommerce() {
    const mediaResponse = await fetch(`${process.env.WP_DESTINATION_URL}/wp-json/wp/v2/media`);

    const media = await mediaResponse.json();

    // console.log(media)
    return media;

}

function getImageId(imageUrl, media) {
    if (!imageUrl) return null;
    const imageFilename = imageUrl.split('/').pop();
    const existingMedia = media.find(m => m.source_url.endsWith(imageFilename));
    return existingMedia ? existingMedia.id : null;
}

function getVariationImageId(imageName, media) {
    if (!imageName) return null;
    const existingMedia = media.find(m => m.title.rendered === imageName);
    return existingMedia ? existingMedia.id : null;
}

function modifyMappedProductsWithMedia(mappedProducts, media) {
    mappedProducts.forEach(product => {

        // console.log(product)

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
    // console.log(mappedProducts)
    return mappedProducts;
}


// :: START HELPER FUNCTIONS::

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

// Helper function to check to see if Attribute or Term Exists.
async function checkToSeeIfAttributeAndTermExists() {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const attributesCollection = mongoose.connection.collection('product_attributes');
    const allAttributes = await attributesCollection.find({}).toArray();
    const existingAttributes = await fetchAllFromWooCommerce("products/attributes");

    const existingAttributesMap = existingAttributes.reduce((map, attr) => {
        const slugWithoutPrefix = attr.slug; //.replace(/^pa_/, '').toLowerCase()
        map[slugWithoutPrefix] = attr;
        return map;
    }, {});

    // Array to store the comparison results
    const comparisonResults = [];

    for (const attr of allAttributes) {
        const attrSlug = attr.slug.toLowerCase();
        let attributeResult = {
            status: false,
            name: attr.name,
            woocommerceId: null,
            dbId: attr._id,
            slug: attrSlug,
            terms: []
        };

        if (existingAttributesMap[attrSlug]) {
            attributeResult.status = true;
            attributeResult.woocommerceId = existingAttributesMap[attrSlug].id;

            // Fetch terms for this attribute from WooCommerce
            const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${existingAttributesMap[attrSlug].id}/terms`);
            const existingTermsMap = existingTerms.reduce((map, term) => {
                map[term.name.toLowerCase()] = term;
                return map;
            }, {});

            for (const term of attr.values) {
                if (existingTermsMap[term.toLowerCase()]) {
                    attributeResult.terms.push({
                        exists: true,
                        term_item: {
                            name: term,
                            id: existingTermsMap[term.toLowerCase()].id
                        }
                    });
                } else {
                    attributeResult.terms.push({
                        exists: false,
                        term_item: {
                            name: term,
                            id: null
                        }
                    });
                }
            }
        } else {
            // If attribute does not exist in WooCommerce, add all MongoDB terms as non-existing
            for (const term of attr.values) {
                attributeResult.terms.push({
                    exists: false,
                    term_item: {
                        name: term,
                        id: null
                    }
                });
            }
        }
        comparisonResults.push(attributeResult);
    }


    // console.log(comparisonResults)
    return comparisonResults;
}

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
    // if (!areImagesEqual(newData.image, currentData.image)) return true;

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
// function areImagesEqual(newImage, currentImage) {
//     // Compare the image objects
//     // This assumes images are compared based on an ID or src attribute
//     return JSON.stringify(newImage) === JSON.stringify(currentImage);
// }
// :: END HELPER FUNCTIONS::


// :: DATA PREPORATION ::
// Prepares the Variable Product Data into the pushProductsToWooCommerce structure (Note, Might need further refactoring to use Schema)
function prepareParentProductData(variableProducts) {
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
        // image: product.images[0],
        woo_id: product.woo_id
    }));
}

// :: MAIN FUNCTION for Parent Product integration
// Upload the Parent Products
async function uploadParentProducts(ws, variableProducts) {
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
// ::PUSH VARIATIONS UP TO WOOCOMMERCE (COULD DO WITH OPTIMISING).
async function uploadVariations(ws, variations, wooParentSkus, wooParentIds) {

    let productDataPush = {
        create: [],
        update: []
    }
    let allVariationIds = [];
    let allVariationSkus = [];

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
        for (const variation of theVars) {
            const existsProduct = await checkToSeeIfVariationSKUexists(variation.sku, variation.parent_id) // Function to check WOOCommerce with SKU. Returns id if successful
            variation.parent_id = parentId; // Directly associate with its parent ID
            if (false === existsProduct.existsInWoo) {
                sendMessage(ws, `<strong>CREATE: </strong> SKU: <strong>${existsProduct.sku}</strong> does not exist`)
                // Send off to be created
                productDataPush.create.push(variation);
            } else if (true === existsProduct.existsInWoo) {
                sendMessage(ws, `<strong>INFO: </strong> SKU: <strong>${existsProduct.sku}</strong> exists with ID: <strong>${existsProduct.id}</strong>`)

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
                    for (const product of response.data.create) {
                        await MappedProduct.findOneAndUpdate({ sku: product.sku }, { $set: { woo_id: product.id } }, { upsert: true });
                        allVariationIds.push(product.id);
                        allVariationSkus.push(product.sku);
                    }
                }
                if (response.data.update && response.data.update.length > 0) {

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
        const { variableProducts, variations } = separateProductsAndVariations(mProducts);

        sendMessage(ws, '== Process Variables on website ==')
        const { wooParentIds, wooParentSkus } = await uploadParentProducts(ws, variableProducts);

        sendMessage(ws, '== Process Variations on website ==')
        const { wooVariationSkus } = await uploadVariations(ws, variations, wooParentSkus, wooParentIds);


        // const pushMedia = pushedMedia(mProducts);
        // console.log(pushMedia)

        const parentProductsLength = wooParentSkus.length;
        const variationProductsLength = wooVariationSkus.length;

        sendMessage(ws, `<strong>!!!!!Successfully pushed ${parentProductsLength} Parent Products and their ${variationProductsLength} variations to WooCommerce!!!!</strong>`);
    } catch (error) {
        console.error("Error pushing products to WooCommerce:", error);
        sendMessage(ws, `Error pushing products to WooCommerce: ${error}`);
    }
}


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

        // return

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
