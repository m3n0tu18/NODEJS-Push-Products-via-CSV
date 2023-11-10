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
const csv = require('csvtojson');
const { default: WooCommerceRestApi } = require("@woocommerce/woocommerce-rest-api");

const WooCommerce = require("@woocommerce/woocommerce-rest-api").default

const WooCommerceAPI = new WooCommerce({
    url: process.env.WP_DESTINATION_URL,
    consumerKey: process.env.WC_CONSUMER_KEY,
    consumerSecret: process.env.WC_CONSUMER_SECRET,
    version: process.env.WC_API_VERSION,
    queryStringAuth: true,
});

// data cleaner upper (used in schema) (USED AND WORKS)
function splitAndTrim(value) {
    return typeof value === 'string' ? value.split('|').map(item => item.trim()) : value;
}

// Mongo DB Schema (USED AND WORKS)
const tempProductSchema = new mongoose.Schema({
    "SKU": String,
    "Parent SKU": String,
    "Product Title": String,
    "Description": String,
    "Trade Price": Number,
    "Platinum Price (-50%)": Number,
    "Variable|Simple": String,
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
})

// Preparing WooCommerce Schema for Batch Upload (IN PROGRESS)
const productSchema = new mongoose.Schema({
    name: String,
    slug: {
        type: String,
        unique: true
    },
    date_created: {
        type: String,
        default: new Date().toISOString(),
        immutable: true
    },
    date_created_gmt: {
        type: String,
        default: new Date().toISOString(),
        immutable: true
    },
    date_modified: {
        type: String,
        default: new Date().toISOString(),
    },
    date_modified_gmt: {
        type: String,
        default: new Date().toISOString(),
    },
    type: String,
    status: String,
    featured: Boolean,
    catalog_visibility: String,
    description: String,
    short_description: String,
    sku: String,
    price: String,
    regular_price: String,
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
    _links: Object
})

const attributeSchema = new mongoose.Schema({
    name: String,
    variation: Boolean,
    values: [String]
});

const Attribute = mongoose.model('Attribute', attributeSchema, 'product_attributes');


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
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function notify(ws, message) {
    await delay(process.env.DELAY_TIMEOUT)
    sendMessage(ws, message)
}

// Function to convert CSV to MongoDB
async function convertCSVToMongo(ws) {
    const csvFilePath = './csv_data/tubular-data-updated.csv';
    try {
        // await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

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

            // console.log(result)

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
        // await mongoose.connection.close();
    } catch (err) {
        console.log(err);
        sendMessage(ws, `Error: ${err}`);
    }
}

// ------------------------------

// START Extract Attributes
async function extractAttributes(ws) {
    try {
        // Fields to extract from the database
        const fields = ["Accessories", "Baffle Colour", "Beam Angle", "Body Colour", "Colour Temperature", "Cut-Out", "Dimming", "IP Rating", "Lumen Output", "Socket Type", "Wattage", "mA"];
        const products = await fetchProducts(fields);
        const attributes = getAttributesCollection();

        for (const product of products) {
            await processProductAttributes(product, fields, attributes);
        }
        // const attributeCache = await buildAttributeCache(attributes, fields);

        // // console.log(attributeCache)


        // for (const product of products) {
        //     await processProductAttributes(product, fields, attributeCache, attributes);
        // }
    } catch (err) {
        console.error('Error in extractAttributes:', err);
        sendMessage(ws, `Error in extractAttributes: ${err.message}`);
    }
}
async function fetchProducts(fields) {
    return await TempProduct.find({}, fields).lean().exec();
}
function getAttributesCollection() {
    // Check if the model exists, if not, create it
    let attributes;
    if (!mongoose.models.Attribute) {
        attributes = Attribute;
    } else {
        attributes = mongoose.model('Attribute');
    }

    console.log('Got attributes collection');
    return attributes;
}

async function buildAttributeCache(attributesCollection, fields) {
    let cache = {};
    for (const field of fields) {
        const existingAttribute = await attributesCollection.findOne({ name: field });
        console.log(`Existing attribute for ${field}:`, existingAttribute);

        cache[field] = existingAttribute ? new Set(existingAttribute.values) : new Set();
    }
    console.log(cache);
    return cache;
}
// async function buildAttributeCache(attributesCollection, fields) {
//     let cache = {};
//     for (const field of fields) {
//         const existingAttribute = await attributesCollection.findOne({ name: field });
//         cache[field] = existingAttribute ? new Set(existingAttribute.values) : new Set();
//     }
//     return cache;
// }
async function processProductAttributes(product, fields, attributesCollection) {
    for (const field of fields) {
        const attrData = product[field];
        if (Array.isArray(attrData) && attrData[0] && attrData[0].variation !== undefined) {
            const variation = attrData[0].variation;
            for (const attrVal of attrData[0].values) {
                await updateAttributeDirectly(field, attrVal, variation, attributesCollection);
            }
        }
    }
}

async function updateAttributeDirectly(fieldName, value, variation, attributesCollection) {
    // Check if the attribute with the specified value already exists
    const existingAttribute = await attributesCollection.findOne({ name: fieldName, values: value });

    if (!existingAttribute) {
        // Update or insert the attribute
        await attributesCollection.updateOne(
            { name: fieldName },
            {
                $set: { variation: variation },
                $push: { values: value }
            },
            { upsert: true } // This will create the document if it doesn't exist
        );
    }
}


async function updateAttributeIfNecessary(fieldName, value, variation, cache, attributesCollection) {
    if (!cache[fieldName].has(value)) {
        cache[fieldName].add(value);
        await attributesCollection.updateOne(
            { name: fieldName },
            { $set: { variation: variation }, $push: { values: value } }
        );
        // console.log(res);
    }
}
// END Extract Attributes

// ------------------------------

// START Save Categories to WooCommerce
async function saveCategoriesToWooCommerce() {
    try {
        const csvProductDataCollection = getCsvProductDataCollection();
        const allCategories = await fetchAllCategories(csvProductDataCollection);

        const uniqueCategories = extractUniqueCategories(allCategories);
        await saveCategoriesToMongo(uniqueCategories);

        const existingWooCategories = await fetchExistingWooCommerceCategories();
        await postNewCategoriesToWooCommerce(uniqueCategories, existingWooCategories);
    } catch (error) {
        console.error("Error saving categories to WooCommerce:", error);
    }
}
function getCsvProductDataCollection() {
    return mongoose.connection.collection('csvProductData');
}
async function fetchAllCategories(collection) {
    return await collection.find({}).toArray();
}
function extractUniqueCategories(allCategories) {
    return [...new Set(allCategories.flatMap(product => product.Category))];
}
async function saveCategoriesToMongo(categories) {
    const categoriesCollection = mongoose.connection.collection('product_categories');
    const categoriesToInsert = categories.map(category => ({ name: category }));
    await categoriesCollection.insertMany(categoriesToInsert);
    return categoriesToInsert;
}
async function fetchExistingWooCommerceCategories() {
    const response = await WooCommerceAPI.get('products/categories');
    // console.log(response)
    // return;
    return response.data;
}
async function postNewCategoriesToWooCommerce(categories, existingWooCategories) {
    for (let category of categories) {
        const existingCategory = existingWooCategories.find(wooCategory => wooCategory.name === category.name);
        if (!existingCategory) {
            const response = await WooCommerceAPI.post('products/categories', { name: category.name });
            const woo_id = response.data.id;
            await updateMongoCategoryWithWooId(category.name, woo_id);
        }
    }
}
async function updateMongoCategoryWithWooId(categoryName, wooId) {
    const categoriesCollection = mongoose.connection.collection('product_categories');
    await categoriesCollection.updateOne({ name: categoryName }, { $set: { woo_id: wooId } });
}
// END Save Categories to WooCommerce

// ------------------------------

// START addOrUpdateGlobalAttributes 
async function addOrUpdateGlobalAttributes(ws, WooCommerceAPI) {
    try {
        const attributesCollection = getAttributesCollection();
        const allAttributes = await fetchAllAttributes(attributesCollection);

        const existingAttributes = await fetchAllFromWooCommerce("products/attributes", WooCommerceAPI);

        for (const attr of allAttributes) {
            await handleAttribute(attr, existingAttributes, WooCommerceAPI);
        }

        await deleteUnmatchedWooCommerceAttributes(allAttributes, existingAttributes, WooCommerceAPI);
    } catch (error) {
        console.error("Error in addOrUpdateGlobalAttributes:", error);
    }
}
function getAttributesCollection() {
    return mongoose.connection.collection('product_attributes');
}
async function fetchAllAttributes(collection) {
    return await collection.find({}).toArray();
}
async function handleAttribute(attr, existingAttributes, WooCommerceAPI) {
    const existingAttribute = existingAttributes.find(a => a.slug === attr.name.toLowerCase());

    if (existingAttribute) {
        await updateExistingAttribute(attr, existingAttribute, WooCommerceAPI);
    } else {
        await createNewAttribute(attr, WooCommerceAPI);
    }
}
async function updateExistingAttribute(attr, existingAttribute, WooCommerceAPI) {
    try {
        // Update attribute
        await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}`, {
            name: attr.name,
            slug: attr.name.toLowerCase(),
            type: "select",
            order_by: "menu_order",
            has_archives: true,
            is_variation: attr.variation
        });

        // Fetch existing terms for the attribute
        const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${existingAttribute.id}/terms`, WooCommerceAPI);

        // Update or create terms
        for (const term of attr.values) {
            const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());
            if (existingTerm) {
                await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`, {
                    name: term,
                    slug: term.toLowerCase()
                });
            } else {
                await WooCommerceAPI.post(`products/attributes/${existingAttribute.id}/terms`, {
                    name: term,
                    slug: term.toLowerCase()
                });
            }
        }

        // Delete terms not present in MongoDB
        for (const existingTerm of existingTerms) {
            if (!attr.values.includes(existingTerm.name)) {
                await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`);
            }
        }
    } catch (err) {
        console.error(`Error updating attribute "${attr.name}": ${err.message}`);
    }
}
async function createNewAttribute(attr, WooCommerceAPI) {
    try {
        const response = await WooCommerceAPI.post("products/attributes", {
            name: attr.name,
            slug: attr.name.toLowerCase(),
            type: "select",
            order_by: "menu_order",
            has_archives: true,
            is_variation: attr.variation
        });

        if (response.data && response.data.id) {
            for (const term of attr.values) {
                await WooCommerceAPI.post(`products/attributes/${response.data.id}/terms`, {
                    name: term,
                    slug: term.toLowerCase()
                });
            }
        }
    } catch (err) {
        console.error(`Error creating attribute "${attr.name}": ${err.message}`);
    }
}
async function deleteUnmatchedWooCommerceAttributes(allAttributes, existingAttributes, WooCommerceAPI) {
    try {
        for (const existingAttribute of existingAttributes) {
            if (!allAttributes.some(attr => attr.name.toLowerCase() === existingAttribute.slug)) {
                await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}`);
            }
        }
    } catch (err) {
        console.error(`Error deleting WooCommerce attribute: ${err.message}`);
    }
}
// END addOrUpdateGlobalAttributes

// ------------------------------

// START mapProductsForWooCommerce
async function mapProductsForWooCommerce(ws) {
    let finalMappedProducts = [];

    try {
        const productsCollection = getProductsCollection();
        const allProducts = await fetchAllProducts(productsCollection);

        const attributesCollection = getAttributesCollection();
        const allAttributes = await fetchAllAttributes(attributesCollection);

        const categoriesCollection = getCategoriesCollection();

        const parentProducts = filterParentProducts(allProducts);
        const variations = filterVariations(allProducts);

        for (const parentProduct of parentProducts) {
            const mappedParentProduct = await mapProductToWooFormat(parentProduct, allAttributes, categoriesCollection);
            mappedParentProduct.variations = await mapVariationsForParent(parentProduct, variations, allAttributes, categoriesCollection);

            finalMappedProducts.push(mappedParentProduct);
        }

        await saveMappedProducts(finalMappedProducts);

        if (ws) {
            sendMessage(ws, "Mapped products and their variations have been created and stored in the mappedProducts collection!");
        }
        return finalMappedProducts;

    } catch (err) {
        console.log(err);
        if (ws) {
            sendMessage(ws, `Error: ${err}`);
        }
    }
}
function getProductsCollection() {
    return mongoose.connection.collection('csvProductData');
}
async function fetchAllProducts(productsCollection) {
    return productsCollection.find({}).toArray();
}
function getAttributesCollection() {
    return mongoose.connection.collection('product_attributes');
}
async function fetchAllAttributes(attributesCollection) {
    return attributesCollection.find({}).toArray();
}
function getCategoriesCollection() {
    return mongoose.connection.collection('product_categories');
}
function filterParentProducts(allProducts) {
    return allProducts.filter(product => product["Variable|Simple"] === "variable");
}
function filterVariations(allProducts) {
    return allProducts.filter(product => product["Variable|Simple"] === "variation");
}
async function mapVariationsForParent(parentProduct, variations, allAttributes, categoriesCollection) {
    return Promise.all(
        variations.filter(variation => variation["Parent SKU"] === parentProduct["SKU"])
            .map(variation => mapProductToWooFormat(variation, allAttributes, categoriesCollection))
    );
}
async function saveMappedProducts(finalMappedProducts) {
    const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
    const bulkOps = finalMappedProducts.map(product => ({
        updateOne: {
            filter: { sku: product.sku },
            update: { $set: product },
            upsert: true
        }
    }));
    await MappedProduct.bulkWrite(bulkOps);
}

// END mapProductsForWooCommerce

// ------------------------------

// START mapProductToWooFormat
async function mapProductToWooFormat(product, allAttributes, categoriesCollection) {
    const wooCategoryIds = await mapCategoriesToWooIds(product, categoriesCollection);
    const attributes = mapAttributes(product, allAttributes);
    const downloads = mapDownloads(product);
    const images = mapImages(product);
    const tags = mapTags(product);

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
        type: product["Variable|Simple"] === "variable" ? "variable" : "variation",
        price: product["Trade Price"] ? product["Trade Price"].toString() : "0",
        regular_price: product["Trade Price"] ? product["Trade Price"].toString() : "0",

        attributes: attributes,
        downloadable: downloads.length > 0,
        downloads: downloads,
        images: images,
        categories: wooCategoryIds.map(id => ({ id })),
        tags: tags,
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
        variations: []
    };
}
async function mapCategoriesToWooIds(product, categoriesCollection) {
    const getCategoryWooId = async (categoryName) => {
        const categoryDoc = await categoriesCollection.findOne({ name: categoryName });
        return categoryDoc ? categoryDoc.woo_id : null;
    };

    return Promise.all(product["Category"].map(getCategoryWooId));
}
function mapAttributes(product, allAttributes) {
    return allAttributes.reduce((acc, attribute) => {
        if (product[attribute.name]) {
            acc.push({
                id: attribute.woo_id,
                variation: attribute.variation,
                option: product[attribute.name].map(item => item.values).flat()
            });
        }
        return acc;
    }, []);
}
function mapDownloads(product) {
    return [
        ...product["Datasheet"] ? [{ name: "Datasheet", file: product["Datasheet"].toString() }] : [],
        ...product["Instruction Manual"] ? [{ name: "Instruction Manual", file: product["Instruction Manual"].toString() }] : [],
        ...product["Photometry"] ? [{ name: "Photometry", file: product["Photometry"].toString() }] : [],
        ...product["CAD Drawings"] ? [{ name: "CAD Drawings", file: product["CAD Drawings"].toString() }] : []
    ];
}
function mapImages(product) {
    return product["Image URL"].map(url => ({
        src: url,
        name: url.split('/').pop()
    }));
}
function mapTags(product) {
    return product["Tags"].map(tagName => ({
        name: tagName
    }));
}
// END mapProductToWooFormat

// ---------------------------

// START pushProductsToWooCommerce
async function fetchExistingMedia(WooCommerceAPI) {
    try {
        const response = await WooCommerceAPI.get('media');
        return response.data;
    } catch (error) {
        console.error('Error fetching existing media:', error);
        throw error; // Rethrow the error for upstream handling
    }
}

async function fetchExistingParentSKUs(WooCommerceAPI) {
    try {
        // Fetching all products, assuming fetchAllFromWooCommerce is a helper function to handle pagination
        const allProducts = await fetchAllFromWooCommerce('products', WooCommerceAPI);
        return allProducts.filter(product => product.type === 'simple' || product.type === 'variable');
    } catch (error) {
        console.error('Error fetching existing parent SKUs:', error);
        throw error; // Rethrow the error for upstream handling
    }
}

async function fetchExistingVariationSKUs(WooCommerceAPI) {
    try {
        // Fetching all variations, assuming fetchAllFromWooCommerce handles pagination and retrieves all variations
        return await fetchAllFromWooCommerce('products/variations', WooCommerceAPI);
    } catch (error) {
        console.error('Error fetching existing variation SKUs:', error);
        throw error; // Rethrow the error for upstream handling
    }
}

async function processParentProducts(mappedProducts, existingParentSKUs, WooCommerceAPI) {
    for (const product of mappedProducts) {
        if (product.type === 'variable') { // Assuming parent products are of type 'variable'
            const existingProduct = existingParentSKUs.find(p => p.sku === product.sku);
            if (existingProduct) {
                // Update existing parent product
                try {
                    await WooCommerceAPI.put(`products/${existingProduct.id}`, product);
                } catch (error) {
                    console.error(`Error updating parent product SKU ${product.sku}:`, error);
                }
            } else {
                // Create new parent product
                try {
                    await WooCommerceAPI.post('products', product);
                } catch (error) {
                    console.error(`Error creating new parent product SKU ${product.sku}:`, error);
                }
            }
        }
    }
}

async function processVariationProducts(mappedProducts, existingVariationSKUs, WooCommerceAPI) {
    for (const product of mappedProducts) {
        if (product.type === 'variation') { // Assuming variation products are of type 'variation'
            const existingVariation = existingVariationSKUs.find(v => v.sku === product.sku);
            if (existingVariation) {
                // Update existing variation product
                try {
                    await WooCommerceAPI.put(`products/${existingVariation.parent_id}/variations/${existingVariation.id}`, product);
                } catch (error) {
                    console.error(`Error updating variation SKU ${product.sku}:`, error);
                }
            } else {
                // Create new variation product
                const parentProduct = mappedProducts.find(p => p.variations && p.variations.includes(product.sku));
                if (parentProduct && parentProduct.id) {
                    try {
                        await WooCommerceAPI.post(`products/${parentProduct.id}/variations`, product);
                    } catch (error) {
                        console.error(`Error creating new variation SKU ${product.sku}:`, error);
                    }
                }
            }
        }
    }
}

async function pushProductsToWooCommerce(ws, mappedProducts) {
    try {
        const media = await fetchExistingMedia(WooCommerceAPI);
        sendMessage(ws, "Fetched existing media from WooCommerce.");

        const existingParentSKUs = await fetchExistingParentSKUs(WooCommerceAPI);
        sendMessage(ws, "Fetched existing parent SKUs from WooCommerce.");

        const existingVariationSKUs = await fetchExistingVariationSKUs(WooCommerceAPI);
        sendMessage(ws, "Fetched existing variation SKUs from WooCommerce.");

        await processParentProducts(mappedProducts, existingParentSKUs, WooCommerceAPI);
        sendMessage(ws, "Processed parent products.");

        await processVariationProducts(mappedProducts, existingVariationSKUs, WooCommerceAPI);
        sendMessage(ws, "Processed variation products.");

        // Log success message
        sendMessage(ws, "Products successfully pushed to WooCommerce.");
    } catch (error) {
        console.error("Error in pushProductsToWooCommerce:", error);
        sendMessage(ws, `Error: ${error.message}`);
    }
}

async function fetchAllFromWooCommerce(endpoint, WooCommerceAPI) {
    const PER_PAGE = 100; // Define a constant for the number of items per page
    let page = 1;
    let results = [];
    while (true) {
        try {
            const response = await WooCommerceAPI.get(endpoint, { params: { per_page: PER_PAGE, page } });
            results = results.concat(response.data);

            // If the number of results is less than the page size, it's the last page
            if (response.data.length < PER_PAGE) {
                break;
            }

            page++;
        } catch (error) {
            console.error(`Error fetching page ${page} from ${endpoint}:`, error);
            break; // Optionally, you could decide to throw the error or handle it differently
        }
    }

    return results;
}
// END pushProductsToWooCommerce


// Run the Process
// async function processBuilder(ws) {
//     const startTime = Date.now();
//     ws.send("startTimer");

//     try {
//         await notify(ws, "Fetching products from CSV...")
//         await convertCSVToMongo(ws);


//         await notify(ws, "Extracting attributes to new collection")
//         await extractAttributes(ws)


//         await notify(ws, "Extract and create Products in WooCommerce")
//         await saveCategoriesToWooCommerce()

//         await notify(ws, "Adding global attributes to WooCommerce")
//         await addOrUpdateGlobalAttributes(ws, destinationURL, WooCommerceAPI)


//         await notify(ws, "Mapping products for WooCommerce...")
//         const mappedProducts = await mapProductsForWooCommerce(ws);

//         await notify(ws, "Mapping products for WooCommerce...")
//         await pushProductsToWooCommerce(ws, mappedProducts);

//         sendMessage(ws, "Process completed...")
//     } catch (err) {
//         console.log('Error:', err);
//     }

//     const endTime = Date.now();
//     const elapsedTime = (endTime - startTime);

//     const hours = Math.floor(elapsedTime / 3600000);
//     const minutes = Math.floor((elapsedTime - (hours * 3600000)) / 60000);
//     const seconds = Math.floor((elapsedTime - (hours * 3600000) - (minutes * 60000)) / 1000);

//     sendMessage(ws, `Elapsed time: ${hours} hours, ${minutes} minutes, ${seconds} seconds`);

//     // Stop the timer on client side
//     ws.send("stopTimer");
// }
async function processBuilder(ws) {
    try {
        // Establish MongoDB connection
        const connection = await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        // console.log(mongoResult)
        // return;
        // Check if MongoDB connection is established
        if (connection) {
            sendMessage(ws, "MongoDB connected.");
            // Process each step with the established connection
            notify(ws, "Fetching products from CSV...");
            await convertCSVToMongo(ws);

            notify(ws, "Extracting attributes to new collection");
            await extractAttributes(ws);

            // return

            notify(ws, "Extract and create Products in WooCommerce");
            await saveCategoriesToWooCommerce(ws);

            notify(ws, "Adding global attributes to WooCommerce");
            // await addOrUpdateGlobalAttributes(ws, destinationURL, WooCommerceAPI);

            notify(ws, "Mapping products for WooCommerce...");
            // const mappedProducts = await mapProductsForWooCommerce(ws);

            notify(ws, "Pushing products to WooCommerce...");
            // await pushProductsToWooCommerce(ws, mappedProducts);

            sendMessage(ws, "Process completed.");

        } else {
            sendMessage(ws, `Error: ${err}`);
            throw new Error("MongoDB connection failed.");
        }



        // Close MongoDB connection at the end
        await mongoose.connection.close();
        sendMessage(ws, "MongoDB connection closed.");

    } catch (err) {
        console.error("Error in processBuilder:", err);
        if (mongoose.connection.readyState) {
            // Close connection if it's still open in case of an error
            await mongoose.connection.close();
            console.log("MongoDB connection closed due to an error.");
        }
        if (ws) {
            sendMessage(ws, `Error: ${err.message}`);
        }
    }
}


module.exports = { processBuilder };

