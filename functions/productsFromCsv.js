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

// Mongo DB Model (USED AND WORKS)
const TempProduct = mongoose.model('TempProduct', tempProductSchema, 'csvProductData');
const Product = mongoose.model('Product', productSchema, 'wooCommerceProducts')

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

        const attributeCache = await buildAttributeCache(attributes, fields);

        for (const product of products) {
            await processProductAttributes(product, fields, attributeCache, attributes);
        }
    } catch (err) {
        console.error('Error in extractAttributes:', err);
        sendMessage(ws, `Error in extractAttributes: ${err.message}`);
    }
}
async function fetchProducts(fields) {
    return await TempProduct.find({}, fields).lean().exec();
}
function getAttributesCollection() {
    return mongoose.connection.collection('product_attributes');
}
async function buildAttributeCache(attributesCollection, fields) {
    let cache = {};
    for (const field of fields) {
        const existingAttribute = await attributesCollection.findOne({ name: field });
        cache[field] = existingAttribute ? new Set(existingAttribute.values) : new Set();
    }
    return cache;
}
async function processProductAttributes(product, fields, cache, attributesCollection) {
    for (const field of fields) {
        const attrData = product[field];
        if (Array.isArray(attrData) && attrData[0] && attrData[0].variation !== undefined) {
            const variation = attrData[0].variation;
            for (const attrVal of attrData[0].values) {
                await updateAttributeIfNecessary(field, attrVal, variation, cache, attributesCollection);
            }
        }
    }
}
async function updateAttributeIfNecessary(fieldName, value, variation, cache, attributesCollection) {
    if (!cache[fieldName].has(value)) {
        cache[fieldName].add(value);
        await attributesCollection.updateOne(
            { name: fieldName },
            { $set: { variation: variation }, $push: { values: value } }
        );
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
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("MongoDB connected.");

        // Process each step with the established connection
        await convertCSVToMongo(ws);
        await extractAttributes(ws);
        // await saveCategoriesToWooCommerce(ws);
        // await addOrUpdateGlobalAttributes(ws, destinationURL, WooCommerceAPI);
        // const mappedProducts = await mapProductsForWooCommerce(ws);
        // await pushProductsToWooCommerce(ws, mappedProducts);

        // Close MongoDB connection at the end
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");

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


// ::REFERENCE MATERIAL / GARBAGE COLLECTION::


// Get data from Database (UNUSED)
// async function getDataFromDatabase(ws) {
//     let results = []
//     try {
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         // Fetching data from MongoDB
//         results = await TempProduct.find({});

//         // If web socket exists, send the data
//         if (ws) {
//             sendMessage(ws, `Fetched ${results.length} products from the database.`);
//         }

//         // Close the Mongoose connection
//         await mongoose.connection.close();
//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error: ${err}`);
//         }
//     }
//     return results;
// }

// Function to check WooCommerce for existing products (UNUSED)
// async function checkIfProductExists(ws, sku, token, destinationURL) {
//     try {
//         const headers = {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//         };

//         // Making a GET request to WooCommerce to find the product by SKU
//         const response = await WooCommerceAPI.get(`${destinationURL}/wp-json/wc/v3/products`, {
//             headers: headers,
//             params: { sku: sku }
//         });

//         if (response.data && response.data.length > 0) {
//             if (ws) {
//                 sendMessage(ws, `Product with SKU ${sku} already exists in WooCommerce.`);
//             }
//             return true;
//         } else {
//             if (ws) {
//                 sendMessage(ws, `Product with SKU ${sku} does not exist in WooCommerce.`);
//             }
//             return false;
//         }
//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error while checking WooCommerce for SKU ${sku}: ${err}`);
//         }
//         return false;
//     }
// }

// Extract and group terms from database to new collection (USED AND WORKS)

// async function extractAttributes(ws) {
//     // Connect to MongoDB
//     await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//     // Fields to extract from the database
//     const fields = ["Accessories", "Baffle Colour", "Beam Angle", "Body Colour", "Colour Temperature", "Cut-Out", "Dimming", "IP Rating", "Lumen Output", "Socket Type", "Wattage", "mA"];

//     // Fetch only the desired fields from MongoDB
//     const products = await TempProduct.find({}, fields).lean().exec();

//     // Create a new collection called attributes
//     const attributes = mongoose.connection.collection('product_attributes');

//     // Use a set to keep track of existing attributes and their values
//     const attributeCache = {};

//     // Loop through each product
//     for (const product of products) {
//         // Loop through each attribute in the product
//         for (const attribute of fields) {
//             const attrData = product[attribute];

//             // Check if attrData is an array and has relevant attribute structure
//             if (Array.isArray(attrData) && attrData[0] && attrData[0].variation !== undefined) {
//                 const variation = attrData[0].variation;

//                 for (const attrVal of attrData[0].values) {
//                     if (!attributeCache[attribute]) {
//                         // Fetch attribute from database if not in cache
//                         const existingAttribute = await attributes.findOne({ name: attribute });
//                         attributeCache[attribute] = existingAttribute ? new Set(existingAttribute.values) : new Set();

//                         // If it doesn't exist in the database, create it
//                         if (!existingAttribute) {
//                             await attributes.insertOne({
//                                 name: attribute,
//                                 variation: variation,
//                                 values: []
//                             });
//                         }
//                     }

//                     // If value is not in cache, add to both cache and database
//                     if (!attributeCache[attribute].has(attrVal)) {
//                         attributeCache[attribute].add(attrVal);
//                         await attributes.updateOne(
//                             { name: attribute },
//                             { $push: { values: attrVal } }
//                         );
//                     }
//                 }
//             }
//         }
//     }
// }
// Function to fetch all results from WooCommerce with pagination (USED AND WORKS)
// async function fetchAllFromWooCommerce(endpoint, WooCommerceAPI) {
//     let page = 1;
//     let results = [];
//     while (true) {
//         const response = await WooCommerceAPI.get(endpoint, { params: { per_page: 100, page } });
//         results = results.concat(response.data);
//         if (response.data.length < 100) break; // Less than 100 results means it's the last page
//         page++;
//     }
//     return results;
// }

// Add or update Global Attributes within WooCommerce (USED AND WORKS)
// async function addOrUpdateGlobalAttributes(ws, destinationURL, WooCommerceAPI) {
//     await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
//     const attributes = mongoose.connection.collection('product_attributes');
//     const allAttributes = await attributes.find({}).toArray();

//     const existingAttributes = await fetchAllFromWooCommerce("products/attributes", WooCommerceAPI);


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
//             } catch (err) {
//                 console.error(`Error updating attribute: ${err.message}`);
//                 continue; // Skip the current loop iteration
//             }

//             // When fetching terms for an attribute:
//             const existingTerms = await fetchAllFromWooCommerce(`products/attributes/${existingAttribute.id}/terms`, WooCommerceAPI);

//             for (const term of attr.values) {
//                 const existingTerm = existingTerms.find(t => t.slug === term.toLowerCase());

//                 try {
//                     if (existingTerm) {
//                         // If term exists, update it (if necessary)
//                         await WooCommerceAPI.put(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                     } else {
//                         // If term doesn't exist, create it
//                         await WooCommerceAPI.post(`products/attributes/${existingAttribute.id}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                     }
//                 } catch (err) {
//                     console.error(`Error handling term "${term}": ${err.message}`);
//                 }


//             }

//             // Delete any terms in WooCommerce that don't exist in the database
//             for (const existingTerm of existingTerms) {
//                 if (!attr.values.includes(existingTerm.name)) {
//                     try {
//                         await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`);
//                     } catch (err) {
//                         console.error(`Error deleting term "${existingTerm.name}": ${err.message}`);
//                     }
//                 }
//             }

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
//                     await attributes.updateOne({ _id: attr._id }, { $set: { woo_id: attributeResponse.data.id } });
//                     for (const term of attr.values) {
//                         await WooCommerceAPI.post(`products/attributes/${attributeResponse.data.id}/terms`, {
//                             name: term,
//                             slug: term.toLowerCase()
//                         });
//                     }
//                 }
//             } catch (err) {
//                 console.error(`Error creating attribute "${attr.name}": ${err.message}`);

//             }

//         }
//     }

//     // Delete any attributes in WooCommerce that don't exist in the database
//     for (const existingAttribute of existingAttributes) {
//         if (!allAttributes.some(attr => attr.name.toLowerCase() === existingAttribute.slug)) {
//             try {
//                 await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}`);
//             } catch (err) {
//                 console.error(`Error deleting attribute "${existingAttribute.slug}": ${err.message}`);

//             }
//         }
//     }

//     mongoose.connection.close();
// }

// async function mapProductsForWooCommerce(ws) {
//     let finalMappedProducts = [];

//     try {
//         // Connect to MongoDB
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         const productsCollection = mongoose.connection.collection('csvProductData');
//         const allProducts = await productsCollection.find({}).toArray();

//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         const categoriesCollection = mongoose.connection.collection('product_categories');

//         const parentProducts = allProducts.filter(product => product["Variable|Simple"] === "variable");
//         const variations = allProducts.filter(product => product["Variable|Simple"] === "variation");

//         for (const parentProduct of parentProducts) {
//             const mappedParentProduct = await mapProductToWooFormat(parentProduct, allAttributes, categoriesCollection);
//             mappedParentProduct.variations = [];

//             for (const variation of variations) {
//                 if (variation["Parent SKU"] === parentProduct["SKU"]) {
//                     const mappedVariation = await mapProductToWooFormat(variation, allAttributes, categoriesCollection);
//                     finalMappedProducts.push(mappedVariation);
//                     mappedParentProduct.variations.push(mappedVariation.sku);
//                 }
//             }

//             finalMappedProducts.push(mappedParentProduct);
//         }

//         const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
//         // await MappedProduct.insertMany(finalMappedProducts);

//         const bulkOps = finalMappedProducts.map(product => ({
//             updateOne: {
//                 filter: { sku: product.sku },
//                 update: { $set: product },
//                 upsert: true
//             }
//         }));

//         await MappedProduct.bulkWrite(bulkOps);

//         mongoose.connection.close();

//         if (ws) {
//             sendMessage(ws, "Mapped products and their variations have been created and stored in the mappedProducts collection!");
//         }
//         return finalMappedProducts;

//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error: ${err}`);
//         }
//         mongoose.connection.close();
//     }
// }

// async function mapProductToWooFormat(product, allAttributes, categoriesCollection) {

//     const getCategoryWooId = async (categoryName) => {
//         const categoryDoc = await categoriesCollection.findOne({ name: categoryName });
//         return categoryDoc ? categoryDoc.woo_id : null;
//     };

//     const wooCategoryIds = await Promise.all(product["Category"].map(getCategoryWooId));

//     return {
//         name: product["Product Title"],
//         slug: product["Product Title"].toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'),
//         date_created: new Date().toISOString(),
//         date_created_gmt: new Date().toISOString(),
//         date_modified: new Date().toISOString(),
//         date_modified_gmt: new Date().toISOString(),
//         status: "publish",
//         featured: false,
//         catalog_visibility: "visible",
//         description: product["Description"],
//         sku: product["SKU"],
//         type: product["Variable|Simple"] === "variable" ? "variable" : "variation",
//         price: product["Trade Price"] ? product["Trade Price"].toString() : "0",
//         regular_price: product["Trade Price"] ? product["Trade Price"].toString() : "0",
//         attributes: allAttributes.reduce((acc, attribute) => {
//             if (product[attribute.name]) {
//                 acc.push({
//                     id: attribute.woo_id,
//                     variation: attribute.variation,
//                     option: product[attribute.name].map(item => item.values).flat()
//                 });
//             }
//             return acc;
//         }, []),
//         downloadable: product["Datasheet"] || product["Instruction Manual"] || product["Photometry"] || product["CAD Drawings"] ? true : false,
//         downloads: [
//             ...product["Datasheet"] ? [{ name: "Datasheet", file: product["Datasheet"].toString() }] : [],
//             ...product["Instruction Manual"] ? [{ name: "Instruction Manual", file: product["Instruction Manual"].toString() }] : [],
//             ...product["Photometry"] ? [{ name: "Photometry", file: product["Photometry"].toString() }] : [],
//             ...product["CAD Drawings"] ? [{ name: "CAD Drawings", file: product["CAD Drawings"].toString() }] : []
//         ],

//         images: product["Image URL"].map((url, index) => ({
//             src: url,
//             name: url.split('/').pop()
//         })),
//         categories: product.categories = wooCategoryIds.map(id => ({ id })),

//         tags: product["Tags"].map(tagName => ({
//             name: tagName
//         })),
//         meta_data: [
//             {
//                 key: "_download_expiry",
//                 value: "1"
//             },
//             {
//                 key: "_download_limit",
//                 value: "1"
//             },
//             {
//                 key: "_download_type",
//                 value: "standard"
//             },
//             {
//                 key: "_sold_individually",
//                 value: "yes"
//             },
//         ],
//         variations: []
//     };
// }



// async function saveCategoriesToWooCommerce() {
//     try {
//         // 1. Connect to MongoDB and fetch csvProductData
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         const csvProductData = mongoose.connection.collection('csvProductData');
//         const allCategories = await csvProductData.find({}).toArray();

//         // 2. Extract unique categories
//         const uniqueCategories = [...new Set(allCategories.flatMap(product => product.Category))];

//         // 3. Save unique categories to product_categories collection
//         const categoriesToInsert = uniqueCategories.map(category => ({ name: category }));
//         await mongoose.connection.collection('product_categories').insertMany(categoriesToInsert);

//         // Fetch existing categories from WooCommerce
//         const existingWooCategoriesResponse = await WooCommerceAPI.get('products/categories');
//         const existingWooCategories = existingWooCategoriesResponse.data;

//         // 4. POST categories to WooCommerce and get woo_id
//         for (let category of categoriesToInsert) {
//             // Check if the category already exists in WooCommerce
//             const existingCategory = existingWooCategories.find(wooCategory => wooCategory.name === category.name);

//             if (!existingCategory) {
//                 const response = await WooCommerceAPI.post('products/categories', { name: category.name });
//                 const woo_id = response.data.id;

//                 // 5. Update product_categories collection with woo_id
//                 await mongoose.connection.collection('product_categories').updateOne({ name: category.name }, { $set: { woo_id: woo_id } });
//             }
//         }

//         mongoose.connection.close();
//     } catch (error) {
//         console.error("Error saving categories to WooCommerce:", error);
//     }
// }


// async function fetchExistingParentSKUs(WooCommerceAPI) {
//     let allSKUs = [];
//     let page = 1;

//     while (true) {
//         try {
//             // Fetch products in batches of 100 (or whatever limit you prefer)
//             const response = await WooCommerceAPI.get(`products?per_page=100&page=${page}&fields=sku`);
//             const products = response.data;

//             if (products.length === 0) {
//                 break; // Exit loop if no more products
//             }

//             // Collect SKUs from the current batch
//             const skus = products.map(product => product.sku);
//             allSKUs = allSKUs.concat(skus);

//             page++;
//         } catch (error) {
//             console.error(`Error fetching SKUs on page ${page}:`, error);
//             break;
//         }
//     }

//     return allSKUs;
// }

// async function fetchExistingVariationSKUs(WooCommerceAPI, parentId) {
//     const response = await WooCommerceAPI.get(`products/${parentId}/variations`);
//     return response.data.map(variation => variation.sku);
// }



// const loopThroughWooProducts = async (sku) => {
//     const response = await WooCommerceAPI.get(`products`, { sku: sku });
//     // console.log('Getting Info from SKU:', response.data);
//     // console.log(`The SKU for the parent product ${response.data.id} is: ${response.data.sku}`);
//     return response.data.length ? response.data[0].id : null;
// }

// const getParentIdBySku = async (sku) => {
//     // console.log('The SKU for the parent product is:', sku);

//     const response = await WooCommerceAPI.get(`products`, { sku: sku });
//     // console.log(`Getting Info from SKU ${sku}:`, response.data);
//     return response.data.length ? response.data[0].id : null;
// };


/**
* Helper Classes, to break down the pushProductsToWooCommerce function
**/
// async function fetchMedia(WooCommerceAPI) {
//     try {
//         const response = await WooCommerceAPI.get(`/wp-json/wp/v2/media`);
//         return await response.json()
//     } catch (err) {
//         console.log('Error fetching media: ', err);
//         throw error
//     }
// }




// Pushes Product from MongoDB to WooCommerce
// async function pushProductsToWooCommerce(ws, mappedProducts) {
//     try {
//         // Fetch existing media from WooCommerce
//         const media = await fetchMedia(WooCommerceAPI);

//         const existingParentSKUs = await fetchExistingParentSKUs(WooCommerceAPI);
//         // const existingVariationSKUs = await fetchExistingVariationSKUs(WooCommerceAPI);

//         let parentIdToSku = {};

//         let batchUpdate = {
//             create: [],
//             update: []
//         };

//         let updatedParentIds = [];
//         // Initialize the arrays before using them
//         let createdParentIds = [];

//         // Helper function to check if an image already exists in the WooCommerce media library
//         const getImageId = (imageUrl) => {
//             if (!imageUrl) return null;  // Check if imageUrl exists
//             const imageFilename = imageUrl.split('/').pop();
//             const existingMedia = media.find(m => m.source_url.endsWith(imageFilename));
//             return existingMedia ? existingMedia.id : null;
//         };

//         // Gets the variation image ID and attaches it to the existingMedia array
//         const getVariationImageId = (imageName) => {
//             const existingMedia = media.find(m => m.title.rendered === imageName);
//             return existingMedia ? existingMedia.id : null;
//         };

//         // Loop through each product and its variations to check if the images already exist in the media library
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


//         // Separate variable products and variations based of the MongoDB Database
//         const variableProducts = mappedProducts.filter(p => p.type === "variable");
//         const variations = mappedProducts.filter(p => p.type === "variation");

//         // Map the variable products data to the WooCommerce schema
//         const parentProductsData = variableProducts.map(product => {
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
//                 categories: product.categories,
//                 tags: product.tags,
//             };
//         });

//         console.log("Preparing to upload parent products...");
//         sendMessage(ws, "Preparing to upload parent products...")


//         // Loop through parent products data to populate batchUpdate and updatedParentIds
//         for (const product of parentProductsData) {
//             if (!product.sku) {
//                 console.log("Missing SKU for product:", product);
//                 continue;
//             }
//             const invalidParents = parentProductsData.filter(product => !product.sku);
//             if (invalidParents.length > 0) {
//                 console.log("These parent products are missing SKUs:", invalidParents);
//                 // Optionally, remove them from parentProductsData
//             }
//             if (existingParentSKUs.includes(product.sku)) {
//                 const wcId = await getParentIdBySku(product.sku);
//                 if (wcId) {
//                     product.id = wcId;
//                     batchUpdate.update.push(product);
//                     updatedParentIds.push(wcId);  // Populate updatedParentIds
//                     parentIdToSku[wcId] = product.sku;  // Add to mapping
//                 } else {
//                     console.log(`Invalid ID for SKU ${product.sku}`);
//                 }
//             } else {
//                 batchUpdate.create.push(product);
//                 // Consider populating createdParentIds if needed
//             }
//         }

//         // Chunk parent products for create and update
//         const createParentChunks = chunkArray(batchUpdate.create, 100);
//         const updateParentChunks = chunkArray(batchUpdate.update, 100);

//         for (const createChunk of createParentChunks) {
//             const response = await WooCommerceAPI.post("products/batch", { create: createChunk });
//             createdParentIds = createdParentIds.concat(response.data.create.map(p => p.id));
//             response.data.create.forEach(p => {
//                 parentIdToSku[p.id] = p.sku;
//             });
//             sendMessage(ws, `Batch of ${createChunk.length} parent products created`);
//         }

//         for (const updateChunk of updateParentChunks) {
//             await WooCommerceAPI.post("products/batch", { update: updateChunk });
//             sendMessage(ws, `Batch of ${updateChunk.length} parent products updated`);
//         }


//         // Fetch existing variation SKUs for each parent ID
//         let existingVariationSKUs = [];
//         for (const parentId of updatedParentIds.concat(createdParentIds)) {  // Assuming updatedParentIds and createdParentIds are arrays of parent IDs
//             const skus = await fetchExistingVariationSKUs(WooCommerceAPI, parentId);
//             existingVariationSKUs = existingVariationSKUs.concat(skus);
//         }

//         // Prepare data for variations
//         const variationsData = [];  // This will hold the data for each variation
//         for (const parentId of updatedParentIds.concat(createdParentIds)) {

//             const parentSku = parentIdToSku[parentId];  // Look up SKU from mapping
//             if (!parentSku) {
//                 console.log(`Missing SKU for parent ID: ${parentId}`);
//                 continue;  // Skip this parentId for variations
//             }
//             // Filter variations related to the current parent
//             const childVariations = variations.filter(v => v.sku.startsWith(parentSku));

//             const variationData = childVariations.map(variation => {
//                 const variationImage = variation.images && variation.images[0];
//                 const variationImageId = variationImage ? getVariationImageId(variationImage.name) : null;

//                 // console.log("Variation Attributes:", variation.attributes);
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
//                     image: variationImageId ? { id: variationImageId } : { src: variationImage.src },
//                 };
//             });

//             // Add to the variationsData array
//             variationsData.push({ parentId, data: variationData });
//         }

//         // Performing batch create/update for variations
//         for (const { parentId, data } of variationsData) {
//             const createVariationChunks = chunkArray(data.filter(variation => !existingVariationSKUs.includes(variation.sku)), 100);
//             const updateVariationChunks = chunkArray(data.filter(variation => existingVariationSKUs.includes(variation.sku)), 100);

//             for (const createChunk of createVariationChunks) {
//                 await WooCommerceAPI.post(`products/${parentId}/variations/batch`, { create: createChunk });
//                 // console.log(result);
//                 sendMessage(ws, `Batch of ${createChunk.length} variations created for parent ${parentId}`);
//             }

//             for (const updateChunk of updateVariationChunks) {
//                 await WooCommerceAPI.post(`products/${parentId}/variations/batch`, { update: updateChunk });
//                 // console.log(result)
//                 sendMessage(ws, `Batch of ${updateChunk.length} variations updated for parent ${parentId}`);
//             }
//         }

//         // console.log(`Successfully uploaded ${result.length} variations.`);
//         // sendMessage(ws, `Successfully uploaded ${result.length} variations.`);

//         console.log("Successfully pushed products and their variations to WooCommerce!");
//         sendMessage(ws, "Successfully pushed products and their variations to WooCommerce!")

//     } catch (error) {
//         console.log("Error pushing products to WooCommerce:", error);
//         sendMessage(ws, `Error pushing products to WooCommerce: ${error}`)
//     }
// }



// Utility function to split an array into chunks
// function chunkArray(array, chunkSize) {
//     const limitedArray = array.slice(0, 100);
//     const chunks = [];
//     for (let i = 0; i < limitedArray.length; i += chunkSize) {
//         chunks.push(limitedArray.slice(i, i + chunkSize));
//     }
//     return chunks;
// }
// Utility function to split an array into chunks
// function chunkArray(array, chunkSize, maxItems = array.length) {
//     const chunks = [];
//     let processedItems = 0;  // Count of items processed

//     for (let i = 0; i < array.length && processedItems < maxItems; i += chunkSize) {
//         let chunk = array.slice(i, i + chunkSize);

//         // If adding the whole chunk exceeds maxItems, slice the chunk
//         if (processedItems + chunk.length > maxItems) {
//             chunk = chunk.slice(0, maxItems - processedItems);
//         }

//         chunks.push(chunk);
//         processedItems += chunk.length;
//     }

//     return chunks;
// }

// Add or update products within Mongo Database in preperation for pushing to WooCommerce (IN PROGRESS)
// async function createProductsInDatabase(ws) {

//     try {
//         // Connect to MongoDB
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         const productsCollection = mongoose.connection.collection('csvProductData');
//         const allProducts = await productsCollection.find({}).toArray();

//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         const mappedProducts = allProducts.map(product => {
//             const mappedProduct = { ...product }; // Clone the product

//             // Map the product attributes to the woo_id from the product_attributes collection
//             mappedProduct.attributes = allAttributes.reduce((acc, attribute) => {
//                 if (product[attribute.name]) {
//                     acc.push({
//                         woo_id: attribute.woo_id,
//                         name: attribute.name,
//                         values: product[attribute.name]
//                     });
//                 }
//                 return acc;
//             }, []);

//             return mappedProduct;
//         });

//         // Define a model for the new collection and insert the mapped products.
//         // Assuming you have a Mongoose schema for products named productSchema
//         const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');  // 'mappedProducts' is the name of the new collection
//         await MappedProduct.insertMany(mappedProducts);

//         mongoose.connection.close();

//         if (ws) {
//             sendMessage(ws, "Mapped products have been created and stored in a new collection!");
//         }

//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error: ${err}`);
//         }
//         mongoose.connection.close();
//     }
// }

// async function createProductsInDatabase(ws) {

//     try {
//         // Connect to MongoDB
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         const productsCollection = mongoose.connection.collection('csvProductData');
//         const allProducts = await productsCollection.find({}).toArray();

//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         const mappedProducts = allProducts.map(product => {
//             const mappedProduct = {
//                 name: product["Product Title"],
//                 description: product["Description"],
//                 sku: product["SKU"],
//                 // ... You can add more mappings here as needed ...

//                 attributes: allAttributes.reduce((acc, attribute) => {
//                     if (product[attribute.name]) {
//                         acc.push({
//                             woo_id: attribute.woo_id,
//                             name: attribute.name,
//                             values: product[attribute.name].map(item => item.values).flat()  // Flatten the values array
//                         });
//                     }
//                     return acc;
//                 }, [])
//             };

//             return mappedProduct;
//         });

//         // Define a model for the new collection and insert the mapped products.
//         const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
//         await MappedProduct.insertMany(mappedProducts);

//         mongoose.connection.close();

//         if (ws) {
//             sendMessage(ws, "Mapped products have been created and stored in a new collection!");
//         }

//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error: ${err}`);
//         }
//         mongoose.connection.close();
//     }
// }
// async function createProductsInDatabase(ws) {
//     let finalMappedProducts = []; // This will store both parent products and their variations

//     try {
//         // Connect to MongoDB
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         const productsCollection = mongoose.connection.collection('csvProductData');
//         const allProducts = await productsCollection.find({}).toArray();

//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         // Extract only variations from the database
//         const existingVariations = allProducts.filter(p => p["Variable|Simple"] === "variation").map(p => p["SKU"]);


//         allProducts.forEach(product => {
//             const mappedProduct = {
//                 name: product["Product Title"],
//                 slug: product["Product Title"].toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'), // Refined slug transformation
//                 date_created: new Date().toISOString(),
//                 date_created_gmt: new Date().toISOString(),
//                 date_modified: new Date().toISOString(),
//                 date_modified_gmt: new Date().toISOString(),
//                 status: "publish",
//                 featured: false,
//                 catalog_visibility: "visible",
//                 description: product["Description"],
//                 sku: product["SKU"],
//                 type: product["Variable|Simple"] === "variable" ? "variable" : "variation",
//                 height: product["Height"],
//                 width: product["Width"],
//                 length: product["Length"],
//                 price: product["Trade Price"] ? product["Trade Price"].toString() : "0", // Default to "0" if null or undefined
//                 regular_price: product["Trade Price"] ? product["Trade Price"].toString() : "0", // Default to "0" if null or undefined
//                 attributes: allAttributes.reduce((acc, attribute) => {
//                     if (product[attribute.name]) {
//                         acc.push({
//                             id: attribute.woo_id,
//                             option: product[attribute.name].map(item => item.values).flat()
//                         });
//                     }
//                     return acc;
//                 }, []),
//                 downloadable: product["Datasheet"] ? true : false, // Updated logic
//                 downloads: product["Datasheet"] ? [{
//                     name: "Downloadable File",
//                     file: product["Datasheet"].toString()
//                 }] : [],
//                 images: product["Image URL"].map((url, index) => ({
//                     src: url,
//                     name: `Image ${index + 1}`
//                 })),
//                 meta_data: [
//                     {
//                         key: "_download_expiry",
//                         value: "1"
//                     },
//                     {
//                         key: "_download_limit",
//                         value: "1"
//                     },
//                     {
//                         key: "_download_type",
//                         value: "standard"
//                     },
//                     {
//                         key: "_sold_individually",
//                         value: "yes"
//                     },
//                 ],
//                 variations: []
//             };

//             if (product["Variable|Simple"] === "variable") {
//                 const childVariations = generateVariations(product, existingVariations);

//                 childVariations.forEach(variation => {
//                     const finalVariation = { ...mappedProduct, ...variation };
//                     finalMappedProducts.push(finalVariation);
//                     mappedProduct.variations.push(finalVariation.sku); // Add the SKU to the parent's variations list
//                 });

//                 // Now, push the parent after its variations are processed
//                 finalMappedProducts.push(mappedProduct);
//             } else {
//                 finalMappedProducts.push(mappedProduct);
//             }


//         })

//         const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
//         await MappedProduct.insertMany(finalMappedProducts);

//         mongoose.connection.close();

//         if (ws) {
//             sendMessage(ws, "Mapped products and their variations have been created and stored in a new collection!");
//         }

//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error: ${err}`);
//         }
//         mongoose.connection.close();
//     }
// }

// function generateVariations(product, existingVariations) {
//     const attributesForVariation = Object.keys(product).filter(attr => {
//         return product[attr] && product[attr][0] && product[attr][0].variation;
//     });

//     const allCombinations = generateAllCombinations(attributesForVariation.map(attr => product[attr][0].values));


//     const variations = allCombinations.map(combination => {
//         const variationName = `${product["Product Title"]} ${combination.join(' / ')}`;
//         const variationSKU = `${product["SKU"]}-${combination.join('-')}`;
//         const variationSlug = variationName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-');


//         return {
//             // ... other fields ...
//             name: variationName,
//             sku: variationSKU,
//             slug: variationSlug,
//             type: "variation",
//             // ... other fields ...
//         };
//     });

//     // Filter out variations that don't already exist in the database.
//     return variations.filter(variation => existingVariations.includes(variation.sku));
// }

// function generateAllCombinations(arrays) {
//     if (arrays.length === 1) return arrays[0].map(val => [val]);
//     const combinations = [];
//     const rest = generateAllCombinations(arrays.slice(1));
//     for (let i = 0; i < rest.length; i++) {
//         for (let j = 0; j < arrays[0].length; j++) {
//             combinations.push([arrays[0][j], ...rest[i]]);
//         }
//     }
//     return combinations;
// }


// const mongoose = require('mongoose');

// async function mapProductsForWooCommerce(ws) {
//     let finalMappedProducts = [];

//     try {
//         // Connect to MongoDB
//         await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//         const productsCollection = mongoose.connection.collection('csvProductData');
//         const allProducts = await productsCollection.find({}).toArray();

//         const attributesCollection = mongoose.connection.collection('product_attributes');
//         const allAttributes = await attributesCollection.find({}).toArray();

//         const categoriesCollection = mongoose.connection.collection('product_categories');


//         const parentProducts = allProducts.filter(product => product["Variable|Simple"] === "variable");
//         const variations = allProducts.filter(product => product["Variable|Simple"] === "variation");

//         parentProducts.forEach(parentProduct => {
//             const mappedParentProduct = await mapProductToWooFormat(parentProduct, allAttributes, categoriesCollection);
//             mappedParentProduct.variations = [];

//             variations.forEach(variation => {
//                 if (variation["Parent SKU"] === parentProduct["SKU"]) {
//                     const mappedVariation = await mapProductToWooFormat(variation, allAttributes, categoriesCollection);
//                     finalMappedProducts.push(mappedVariation);
//                     mappedParentProduct.variations.push(mappedVariation.sku);
//                 }
//             });

//             finalMappedProducts.push(mappedParentProduct);
//         });

//         const MappedProduct = mongoose.model('MappedProduct', productSchema, 'mappedProducts');
//         await MappedProduct.insertMany(finalMappedProducts);

//         mongoose.connection.close();

//         if (ws) {
//             sendMessage(ws, "Mapped products and their variations have been created and stored in the mappedProducts collection!");
//         }
//         return finalMappedProducts;

//     } catch (err) {
//         console.log(err);
//         if (ws) {
//             sendMessage(ws, `Error: ${err}`);
//         }
//         mongoose.connection.close();
//     }
// }

// async function pushProductsToWooCommerce(mappedProducts) {
//     try {
//         // Separate variable products and variations
//         const variableProducts = mappedProducts.filter(p => p.type === "variable");
//         const variations = mappedProducts.filter(p => p.type === "variation");


//         // Prepare data for parent variable products
//         const parentProductsData = variableProducts.map(product => {
//             return {
//                 name: product.name,
//                 slug: product.slug,
//                 type: product.type,
//                 status: product.status,
//                 description: product.description,
//                 sku: product.sku,
//                 price: product.price,
//                 regular_price: product.regular_price,
//                 attributes: product.attributes,
//                 downloads: product.downloads,
//                 images: product.images
//             };
//         });

//         // Split the parent products data into chunks of 100
//         const parentProductsChunks = chunkArray(parentProductsData, 100);

//         let createdParentIds = [];
//         for (const chunk of parentProductsChunks) {
//             const response = await WooCommerceAPI.post("products/batch", { create: chunk });
//             createdParentIds = createdParentIds.concat(response.data.create.map(p => p.id));
//         }

//         // Prepare data for variations
//         const variationsData = [];
//         createdParentIds.forEach(parentId => {
//             const childVariations = variations.filter(v => v.sku.startsWith(parentId.toString())); // use parentId directly

//             const variationData = childVariations.map(variation => {
//                 return {
//                     regular_price: variation.regular_price,
//                     attributes: variation.attributes,
//                     sku: variation.sku
//                 };
//             });
//             variationsData.push({ parentId: parentId, data: variationData });
//         });

//         // Split the variations data into chunks of 100
//         for (let variationBatch of variationsData) {
//             const variationChunks = chunkArray(variationBatch.data, 100);
//             for (const chunk of variationChunks) {
//                 await WooCommerceAPI.post(`products/${variationBatch.parentId}/variations/batch`, { create: chunk });
//             }
//         }

//         console.log("Successfully pushed products and their variations to WooCommerce!");


//         // Split the parent products data into chunks of 100
//         // const parentProductsChunks = chunkArray(parentProductsData, 100);

//         // let createdParentIds = [];
//         // for (const chunk of parentProductsChunks) {
//         //     const response = await WooCommerce.post("products/batch", { create: chunk });
//         //     createdParentIds = createdParentIds.concat(response.data.create.map(p => p.id));
//         // }

//         // // Batch create parent variable products
//         // const parentProductsResponse = await WooCommerceAPI.post("products/batch", { create: parentProductsData });

//         // // Extract IDs of created parent products
//         // const createdParentIds = parentProductsResponse.data.create.map(p => p.id);

//         // Prepare data for variations
//         // const variationsData = [];
//         // createdParentIds.forEach(parentId => {
//         //     const parentSKU = parentProductsResponse.data.create.find(p => p.id === parentId).sku;
//         //     const childVariations = variations.filter(v => v.sku.startsWith(parentSKU));

//         //     const variationData = childVariations.map(variation => {
//         //         return {
//         //             // ... same logic as before
//         //         };
//         //     });
//         //     variationsData.push({ parentId: parentId, data: variationData });
//         // });

//         // // Split the variations data into chunks of 100
//         // for (let variationBatch of variationsData) {
//         //     const variationChunks = chunkArray(variationBatch.data, 100);
//         //     for (const chunk of variationChunks) {
//         //         await WooCommerce.post(`products/${variationBatch.parentId}/variations/batch`, { create: chunk });
//         //     }
//         // }

//         // console.log("Successfully pushed products and their variations to WooCommerce!");

//         // // Prepare data for variations
//         // const variationsData = [];
//         // createdParentIds.forEach(parentId => {
//         //     const parentSKU = parentProductsResponse.data.create.find(p => p.id === parentId).sku;
//         //     const childVariations = variations.filter(v => v.sku.startsWith(parentSKU));

//         //     const variationData = childVariations.map(variation => {
//         //         return {
//         //             regular_price: variation.regular_price,
//         //             attributes: variation.attributes,
//         //             sku: variation.sku
//         //         };
//         //     });
//         //     variationsData.push({ parentId: parentId, data: variationData });
//         // });

//         // // Batch create variations for each parent product
//         // for (let variationBatch of variationsData) {
//         //     await WooCommerceAPI.post(`products/${variationBatch.parentId}/variations/batch`, { create: variationBatch.data });
//         // }

//         // console.log("Successfully pushed products and their variations to WooCommerce!");

//     } catch (error) {
//         console.log("Error pushing products to WooCommerce:", error);
//     }
// }

// async function pushProductsToWooCommerce(mappedProducts) {
//     try {
//         // Separate variable products and variations
//         const variableProducts = mappedProducts.filter(p => p.type === "variable");
//         const variations = mappedProducts.filter(p => p.type === "variation");

//         // Prepare data for parent variable products
//         const parentProductsData = variableProducts.map(product => {
//             return {
//                 name: product.name,
//                 slug: product.slug,
//                 type: product.type,
//                 status: product.status,
//                 description: product.description,
//                 sku: product.sku,
//                 price: product.price,
//                 regular_price: product.regular_price,
//                 attributes: product.attributes,
//                 downloads: product.downloads,
//                 images: product.images
//             };
//         });

//         // Split the parent products data into chunks of 100
//         const parentProductsChunks = chunkArray(parentProductsData, 100);

//         let createdParentIds = [];
//         let createdParentNames = [];
//         for (const chunk of parentProductsChunks) {
//             const response = await WooCommerceAPI.post("products/batch", { create: chunk });
//             createdParentIds = createdParentIds.concat(response.data.create.map(p => p.id));
//             createdParentNames = createdParentNames.concat(response.data.create.map(p => p.name));
//         }

//         // Prepare data for variations
//         const variationsData = [];
//         createdParentNames.forEach((parentName, index) => {
//             const parentId = createdParentIds[index];
//             const childVariations = variations.filter(v => v.parent === parentName);

//             const variationData = childVariations.map(variation => {
//                 return {
//                     regular_price: variation.regular_price,
//                     attributes: variation.attributes,
//                     sku: variation.sku
//                 };
//             });
//             variationsData.push({ parentId: parentId, data: variationData });
//         });

//         // Split the variations data into chunks of 100
//         for (let variationBatch of variationsData) {
//             const variationChunks = chunkArray(variationBatch.data, 100);
//             for (const chunk of variationChunks) {
//                 await WooCommerceAPI.post(`products/${variationBatch.parentId}/variations/batch`, { create: chunk });
//             }
//         }

//         console.log("Successfully pushed products and their variations to WooCommerce!");

//     } catch (error) {
//         console.log("Error pushing products to WooCommerce:", error);
//     }
// }


// async function pushProductsToWooCommerce(mappedProducts) {
//     try {
//         // Separate variable products and variations
//         const variableProducts = mappedProducts.filter(p => p.type === "variable");
//         const variations = mappedProducts.filter(p => p.type === "variation");

//         // Prepare data for parent variable products
//         const parentProductsData = variableProducts.map(product => {
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
//                     name: attr.name,
//                     visible: true,
//                     variation: attr.variation,
//                     options: [attr.option]
//                 })),
//                 downloads: product.downloads,
//                 images: product.images
//             };
//         });

//         // Split the parent products data into chunks of 100
//         const parentProductsChunks = chunkArray(parentProductsData, 100);

//         let createdParentSkus = [];
//         let createdParentIds = [];
//         for (const chunk of parentProductsChunks) {
//             const response = await WooCommerceAPI.post("products/batch", { create: chunk });
//             createdParentIds = createdParentIds.concat(response.data.create.map(p => p.id));
//             createdParentSkus = createdParentSkus.concat(response.data.create.map(p => p.sku));
//         }

//         // Prepare data for variations
//         const variationsData = [];
//         createdParentSkus.forEach((parentSku, index) => {
//             const parentId = createdParentIds[index];
//             const childVariations = variations.filter(v => v.sku.startsWith(parentSku));

//             const variationData = childVariations.map(variation => {
//                 return {
//                     regular_price: variation.regular_price,
//                     attributes: variation.attributes.map(attr => ({
//                         name: attr.name,
//                         option: attr.option
//                     })),
//                     sku: variation.sku
//                 };
//             });
//             variationsData.push({ parentId: parentId, data: variationData });
//         });

//         // Split the variations data into chunks of 100
//         for (let variationBatch of variationsData) {
//             const variationChunks = chunkArray(variationBatch.data, 100);
//             for (const chunk of variationChunks) {
//                 await WooCommerceAPI.post(`products/${variationBatch.parentId}/variations/batch`, { create: chunk });
//             }
//         }

//         console.log("Successfully pushed products and their variations to WooCommerce!");

//     } catch (error) {
//         console.log("Error pushing products to WooCommerce:", error);
//     }
// }

// Add global products attributes and terms to WooCommerce

// async function addGlobalAttributes(ws, destinationURL) {

//     // Connect to MongoDB
//     await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//     // Get collection called product_attributes
//     const attributes = mongoose.connection.collection('product_attributes');

//     // Get all the attributes from the database
//     const allAttributes = await attributes.find({}).toArray();

//     // Create WooCommerce API instance
//     const WooCommerceAPI = new WooCommerce({
//         url: destinationURL,
//         consumerKey: process.env.WC_CONSUMER_KEY,   // Replace with your consumer key
//         consumerSecret: process.env.WC_CONSUMER_SECRET,  // Replace with your consumer secret
//         wpAPI: true,
//         version: 'wc/v3',
//         queryStringAuth: true  // Force Basic Authentication as query string true and using under HTTPS
//     });

//     // Loop through all attributes and push to WooCommerce
//     for (const attr of allAttributes) {
//         // Prepare the attribute data for WooCommerce
//         const itemData = {
//             name: attr.name,
//             slug: attr.name.toLowerCase(),
//             type: "select",
//             order_by: "menu_order",
//             has_archives: true,
//             is_variation: attr.variation,
//             terms: attr.values.map((value) => ({
//                 name: value,
//                 slug: value.toLowerCase(),
//                 description: "",
//                 menu_order: 0,
//                 count: 0
//             }))
//         };

//         try {
//             // Create the attribute in WooCommerce
//             const attributeResponse = await WooCommerceAPI.post("products/attributes", {
//                 name: attr.name,
//                 slug: attr.name.toLowerCase(),
//                 type: "select",
//                 order_by: "menu_order",
//                 has_archives: true,
//                 is_variation: attr.variation
//             });

//             console.log('Attribute Creation Response:', attributeResponse.data);

//             if (attributeResponse.data && attributeResponse.data.id) {
//                 const woo_id = attributeResponse.data.id;

//                 // Update MongoDB collection with woo_id
//                 await attributes.updateOne(
//                     { _id: attr._id },
//                     { $set: { woo_id: woo_id } }
//                 );

//                 // Now, let's add terms to the created attribute
//                 for (const term of itemData.terms) {
//                     await WooCommerceAPI.post(`products/attributes/${woo_id}/terms`, term);
//                 }

//                 sendMessage(ws, `Added attribute ${attr.name} and its terms to WooCommerce.`);
//             } else {
//                 console.log(`Unexpected WooCommerce response structure for attribute ${attr.name}.`);
//             }

//         } catch (err) {
//             console.log(`Error pushing attribute ${attr.name}:`, err);
//         }
//     }
// }

/* Removed from use as might not actually be working as expected.
async function addOrUpdateProducts() {
    // Connect to MongoDB
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const productsCollection = mongoose.connection.collection('csvProductData');
    const allProducts = await productsCollection.find({}).toArray();

    const attributesCollection = mongoose.connection.collection('product_attributes');
    const allAttributes = await attributesCollection.find({}).toArray();

    // Set up WooCommerce API (similar to previous function)

    for (const product of allProducts) {
        if (product["Variable|Simple"] === "variable" || !product["Parent SKU"]) {
            // This is a parent product
            const existingProduct = await fetchProductFromWooCommerceBySKU(product.SKU, WooCommerceAPI);

            // Map the product attributes to the woo_id from the product_attributes collection
            product.attributes = await mapAttributesToWooIds(product, allAttributes);

            if (existingProduct) {
                await updateProductInWooCommerce(product, existingProduct.id, WooCommerceAPI);
            } else {
                await createProductInWooCommerce(product, WooCommerceAPI);
            }

        } else {
            // This is a child product
            const parentProduct = allProducts.find(p => p.SKU === product["Parent SKU"]);
            if (!parentProduct) {
                console.error(`Parent product not found for SKU: ${product.SKU}`);
                continue;
            }

            const existingVariation = await fetchVariationFromWooCommerceBySKU(product.SKU, WooCommerceAPI);
            if (existingVariation) {
                await updateVariationInWooCommerce(product, parentProduct, existingVariation.id, WooCommerceAPI);
            } else {
                await createVariationInWooCommerce(product, parentProduct, WooCommerceAPI);
            }
        }
    }

    mongoose.connection.close();
}

async function fetchProductFromWooCommerceBySKU(sku, WooCommerceAPI) {
    try {
        const response = await WooCommerceAPI.get(`products`, { sku: sku });
        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        return null;
    } catch (err) {
        console.error(`Failed to fetch product by SKU ${sku}: ${err.message}`, err.response ? err.response.data : "");
        return null;
    }
}

async function updateProductInWooCommerce(productData, productId, WooCommerceAPI) {
    try {
        await WooCommerceAPI.put(`products/${productId}`, productData);
    } catch (err) {
        console.error(`Failed to update product: ${err.message}`);
    }
}

async function createProductInWooCommerce(productData, WooCommerceAPI) {
    try {
        await WooCommerceAPI.post(`products`, productData);
    } catch (err) {
        console.error(`Failed to create product: ${err.message}`);
    }
}

async function fetchVariationFromWooCommerceBySKU(sku, WooCommerceAPI) {
    try {
        const response = await WooCommerceAPI.get(`products/variations`, { sku: sku });
        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        return null;
    } catch (err) {
        console.error(`Failed to fetch variation by SKU: ${err.message}`);
        return null;
    }
}

async function updateVariationInWooCommerce(variationData, parentProduct, variationId, WooCommerceAPI) {
    try {
        await WooCommerceAPI.put(`products/${parentProduct.id}/variations/${variationId}`, variationData);
    } catch (err) {
        console.error(`Failed to update variation: ${err.message}`);
    }
}

async function createVariationInWooCommerce(variationData, parentProduct, WooCommerceAPI) {
    try {
        await WooCommerceAPI.post(`products/${parentProduct.id}/variations`, variationData);
    } catch (err) {
        console.error(`Failed to create variation for parent SKU ${parentProduct.SKU} and child SKU ${variationData.SKU}: ${err.message}`, err.response ? err.response.data : "");

    }
}

async function mapAttributesToWooIds(product, attributesCollection) {
    // Create a new array to store the mapped attributes
    const mappedAttributes = [];

    for (const attribute of Object.keys(product)) {
        if (Array.isArray(product[attribute]) && product[attribute].length > 0 && typeof product[attribute][0] === 'object' && product[attribute][0].variation) {
            // Find the corresponding attribute in the product_attributes collection
            const globalAttribute = attributesCollection.find(attr => attr.name === attribute);
            if (globalAttribute && globalAttribute.woo_id) {
                // Map the attribute value to the woo_id
                mappedAttributes.push({
                    id: globalAttribute.woo_id,
                    options: product[attribute][0].values
                });
            }
        }
    }

    return mappedAttributes;
}
*/

// async function mapAttributesToWooIds(product, attributesCollection) {
//     // Create a new array to store the mapped attributes
//     const mappedAttributes = [];

//     for (const attribute of product.attributes) {
//         // Find the corresponding attribute in the product_attributes collection
//         const globalAttribute = attributesCollection.find(attr => attr.name === attribute.name);
//         if (globalAttribute && globalAttribute.woo_id) {
//             // Map the attribute value to the woo_id
//             mappedAttributes.push({
//                 id: globalAttribute.woo_id,
//                 options: attribute.values // assuming the values don't change
//             });
//         }
//     }

//     return mappedAttributes;
// }

// async function fetchFromApi(url) {
//     const username = process.env.WP_USERNAME;
//     const password = process.env.WP_APP_PASSWORD;
//     const encodedAuth = Buffer.from(`${username}:${password}`).toString('base64');

//     const response = await axios.get(url, {
//         headers: {
//             'Authorization': `Basic ${encodedAuth}`
//         }
//     });
//     return response.data;
// }



// async function fetchWithRetry(endpoint, retries, delay) {
//     for (let i = 0; i < retries; i++) {
//         try {
//             return await Promise.race([
//                 fetchFromApi(endpoint),
//                 new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
//             ]);
//         } catch (error) {
//             console.error(`Attempt ${i + 1} failed. Retrying...`);
//             await sleep(delay);
//         }
//     }
//     throw new Error(`Failed after ${retries} retries.`);
// }

// async function fetchCategoriesOrTags(ws, ids, endpoint) {
//     try {
//         if (!ids || ids.length === 0) return null;

//         const promises = ids.map((id) => fetchWithRetry(`${endpoint}/${id}`, 3, 2000));
//         const data = await Promise.all(promises);

//         // const promises = ids.map((id) => {
//         //     return Promise.race([
//         //         fetchFromApi(`${endpoint}/${id}`),
//         //         new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
//         //     ]);
//         // });

//         // const data = await Promise.all(promises);

//         if (enableCSVExport === 'true') {
//             // sendMessage(ws, "Added Categories & Tags as CSV String")
//             return data.map((item) => item.name).join("|");
//         } else if (enableCSVExport === 'false') {
//             // sendMessage(ws, "Added Categories & Tags as Array")
//             return data.map((item) => item.name);
//         }
//     } catch (error) {
//         sendMessage(ws, `Error fetching categories or tags for IDs: ${ids} - ${error.message}`);
//     }
// }

// async function fetchFeaturedMedia(ws, id) {
//     try {
//         if (!id) return null;


//         const data = await fetchWithRetry(`${process.env.WP_URL}/wp-json/wp/v2/media/${id}`, 3, 2000);

//         // const data = await Promise.race([
//         //     fetchFromApi(`${process.env.WP_URL}/wp-json/wp/v2/media/${id}`),
//         //     new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
//         // ]);

//         await sleep(delayNumber);

//         return data.source_url;
//     } catch (error) {
//         sendMessage(ws, `Error fetching featured media for ID: ${id} - ${error.message}`);
//     }
// }

// async function fetchPosts(ws, url, maxPosts) {
//     let collection;

//     // Validate environment variables at the beginning
//     if (!process.env.WP_URL || !process.env.MAX_POSTS_PER_PAGE) {
//         console.error("Missing required environment variables.");
//         return;
//     }

//     try {
//         await client.connect();
//         collection = client.db(database).collection(dbCollection);
//         sendMessage(ws, "Connecting to DB.. successful");
//     } catch (err) {
//         console.error("Error connecting to db:", err);
//         sendMessage(ws, `Error connecting to db,  ${err}`);
//         return;
//     }

//     if (!collection) {
//         console.error("Database collection is not set. Exiting.");
//         return;
//     }

//     let allPosts = [];
//     let page = 1;
//     const perPage = Number(process.env.MAX_POSTS_PER_PAGE || 20);
//     let retries = Number(process.env.TOTAL_RETRIES || 3);

//     while (retries > 0) {
//         try {
//             const completeUrl = `${url}?status=any&per_page=${perPage}&page=${page}`;
//             console.log(`Fetching page ${page}...`);
//             sendMessage(ws, `<strong>Fetching page ${page}...</strong>`);

//             // const posts = await fetchFromApi(completeUrl);
//             console.log('About to fetch from API.');
//             const posts = await Promise.race([
//                 fetchFromApi(completeUrl),
//                 new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
//             ]);
//             console.log('Fetched or timed out.');


//             // Check if posts were returned, else break the loop
//             if (posts.length === 0) {
//                 sendMessage(ws, "No more posts to fetch, exiting.");
//                 break;
//             }

//             for (const post of posts) {
//                 const existingPost = await collection.findOne({ id: post.id });

//                 if (existingPost) {
//                     // Send this to your update queue
//                     // For example: updateQueue.push(post);
//                     sendMessage(ws, " - Post already exists in MongoDB, skipping.")
//                 } else {
//                     await collection.insertOne(post);
//                 }
//             }

//             sendMessage(ws, ` - Processed ${posts.length} basic posts from page ${page} into MongoDB.`);
//             allPosts.push(...posts);

//             allPosts.push(...posts);
//             if (maxPosts && allPosts.length >= maxPosts) {
//                 allPosts = allPosts.slice(0, maxPosts);
//                 break;
//             }

//             page++;
//             retries = Number(process.env.TOTAL_RETRIES || 3); // Reset retries
//         } catch (err) {
//             retries--;
//             console.error("Fetch Error:", err);
//             sendMessage(ws, `Error: ${err}`);
//             if (retries <= 0) {
//                 break;
//             } else {
//                 await sleep(delayNumber);
//             }
//         }
//     }

//     // for (const post of allPosts) {
//     //     const [categories, tags, featuredMedia] = await Promise.all([
//     //         fetchCategoriesOrTags(ws, post.categories, `${process.env.WP_URL}/wp-json/wp/v2/categories`),
//     //         fetchCategoriesOrTags(ws, post.tags, `${process.env.WP_URL}/wp-json/wp/v2/tags`),
//     //         fetchFeaturedMedia(post.featured_media),
//     //     ]);

//     //     // Update each post with new details
//     //     await collection.updateOne(
//     //         { id: post.id },
//     //         { $set: { categories_details: categories, tags_details: tags, featured_media_details: featuredMedia } }
//     //     );

//     //     sendMessage(ws, `Updated post ID ${post.id} with additional details.`);
//     // }

//     console.log(`Fetched a total of ${allPosts.length} posts.`);
//     sendMessage(ws, `Fetched a total of ${allPosts.length} posts.`);
//     return allPosts;
// }

// async function writePostsToCsv(ws) {

//     // Connect to MongoDB
//     await client.connect();
//     const collection = client.db(database).collection(dbCollection); // Replace with your database and collection names

//     // Fetch all posts from MongoDB
//     const posts = await collection.find().toArray();

//     const csvWriter = createCsvWriter({
//         path: "post_data.csv",
//         header: [
//             { id: "id", title: "ID" },
//             { id: "title", title: "Title" },
//             { id: "status", title: "Status" },
//             { id: "type", title: "Type" },
//             { id: "featured_media_details", title: "Featured Image" },
//             { id: "comment_status", title: "Comment Status" },
//             { id: "sticky", title: "Sticky" },
//             { id: "format", title: "Format" },
//             { id: "categories_details", title: "Categories" },
//             { id: "tags_details", title: "Tags" },
//             { id: "excerpt", title: "Excerpt" },
//             { id: "description", title: "Description" },
//             { id: "date", title: "Date" },
//             { id: "slug", title: "Slug" },
//         ],
//     });

//     const cleanString = (str) => {
//         // Replace newline characters with space
//         let cleanedStr = str.replace(/\r?\n|\r/g, ' ');

//         // Remove non-printable ASCII characters
//         cleanedStr = cleanedStr.replace(/[^\x20-\x7E]/g, '');

//         // Replace tab characters with a space (or some other character)
//         cleanedStr = cleanedStr.replace(/\t/g, ' ');

//         // Remove all HTML tags except those explicitly allowed
//         cleanedStr = cleanedStr.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, function (_, tag) {
//             const allowedTags = ["p", "small", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6"];
//             return allowedTags.includes(tag.toLowerCase()) ? _ : "";
//         });

//         // Double up any internal double quotes
//         cleanedStr = cleanedStr.replace(/"/g, '""');

//         // Wrap the entire string in double quotes
//         cleanedStr = `"${cleanedStr}"`;

//         return cleanedStr;
//     };







//     const records = posts.map((post) => ({
//         id: post.id,
//         title: post.title.rendered,
//         status: post.status,
//         type: post.type,
//         featured_media_details: post.featured_media_details,
//         comment_status: post.comment_status,
//         sticky: post.sticky,
//         format: post.format,
//         categories_details: post.categories_details,
//         tags_details: post.tags_details,
//         excerpt: cleanString(post.excerpt.rendered),
//         description: cleanString(post.content.rendered),
//         date: post.date,
//         slug: post.slug,
//     }));


//     sendMessage(ws, `Writing ${records.length} posts to CSV...`)
//     await csvWriter.writeRecords(records);

//     await client.close();
// }

// async function writePostsToXml(ws) {
//     // Connect to MongoDB
//     await client.connect();
//     const collection = client.db(database).collection(dbCollection);
//     const posts = await collection.find().toArray();

//     const cleanString = (str) => {
//         // Replace newline characters with space
//         let cleanedStr = str.replace(/\r?\n|\r/g, ' ');

//         // Remove non-printable ASCII characters
//         cleanedStr = cleanedStr.replace(/[^\x20-\x7E]/g, '');

//         // Replace tab characters with a space (or some other character)
//         cleanedStr = cleanedStr.replace(/\t/g, ' ');

//         // Remove all HTML tags except those explicitly allowed
//         cleanedStr = cleanedStr.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, function (_, tag) {
//             const allowedTags = ["p", "small", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6"];
//             return allowedTags.includes(tag.toLowerCase()) ? _ : "";
//         });

//         // Double up any internal double quotes
//         cleanedStr = cleanedStr.replace(/"/g, '""');

//         // Wrap the entire string in double quotes
//         cleanedStr = `"${cleanedStr}"`;

//         return cleanedStr;
//     };

//     // const records = posts.map((post) => ({
//     //     id: post.id,
//     //     title: post.title.rendered,
//     //     status: post.status,
//     //     type: post.type,
//     //     featured_media_details: post.featured_media_details,
//     //     comment_status: post.comment_status,
//     //     sticky: post.sticky,
//     //     format: post.format,
//     //     categories_details: post.categories_details,
//     //     tags_details: post.tags_details,
//     //     excerpt: cleanString(post.excerpt.rendered),
//     //     description: cleanString(post.content.rendered),
//     //     date: post.date,
//     //     slug: post.slug,
//     // }));

//     const records = posts.map((post) => {
//         let record = {
//             id: post.id,
//             title: post.title.rendered,
//             status: post.status,
//             type: post.type,
//             comment_status: post.comment_status,
//             sticky: post.sticky,
//             format: post.format,
//             excerpt: cleanString(post.excerpt.rendered),
//             description: cleanString(post.content.rendered),
//             date: post.date,
//             slug: post.slug
//         };

//         // Check for empty or null featured_media_details
//         if (post.featured_media_details && Object.keys(post.featured_media_details).length > 0) {
//             record.featured_media_details = JSON.stringify(post.featured_media_details);
//         }

//         // Check for empty or null categories_details and tags_details
//         if (post.categories_details && post.categories_details.length > 0) {
//             record.categories_details = JSON.stringify(post.categories_details);
//         }
//         if (post.tags_details && post.tags_details.length > 0) {
//             record.tags_details = JSON.stringify(post.tags_details);
//         }

//         return record;
//     });

//     // Create a WXR-compatible XML structure
//     const wxrData = {
//         rss: {
//             $: {
//                 version: "2.0",
//                 "xmlns:wp": "http://wordpress.org/export/1.2/"
//             },
//             channel: [
//                 {
//                     "wp:wxr_version": "1.2",
//                     item: records.map((record) => ({
//                         "wp:post_id": record.id,
//                         "title": record.title,
//                         "wp:post_date": record.date,
//                         "wp:status": record.status,
//                         "wp:post_name": record.slug,
//                         "wp:post_type": record.type,
//                         "wp:comment_status": record.comment_status,
//                         "description": record.description,
//                         "content:encoded": record.description,
//                         "excerpt:encoded": record.excerpt,
//                         "wp:category_nicename": record.categories_details,
//                         "wp:cat_name": record.categories_details,
//                         "wp:tag_name": record.tags_details,
//                         "wp:content": record.description,
//                         "wp:attachment_url": record.featured_media_details,
//                         // add other fields as needed
//                     })),
//                 }
//             ]
//         }
//     };

//     // Build XML
//     const builder = new xml2js.Builder();
//     const xml = builder.buildObject(wxrData);

//     require('fs').writeFileSync('post_data.xml', xml);

//     await client.close();


//     // const builder = new xml2js.Builder();
//     // const xml = builder.buildObject({ posts: records });

//     // require('fs').writeFileSync('post_data.xml', xml);

//     // await client.close();

//     // const builder = new xml2js.Builder();
//     // const xml = builder.buildObject({ posts: records });

//     // require('fs').writeFileSync('post_data.xml', xml);

//     // await client.close();
// }

// async function fetchAdditionalDetails(ws, posts, collection) {
//     for (const post of posts) {
//         try {
//             const [categories, tags, featuredMedia] = await Promise.all([
//                 fetchCategoriesOrTags(ws, post.categories, `${process.env.WP_URL}/wp-json/wp/v2/categories`),
//                 fetchCategoriesOrTags(ws, post.tags, `${process.env.WP_URL}/wp-json/wp/v2/tags`),
//                 fetchFeaturedMedia(ws, post.featured_media),
//             ]);

//             // Update each post with new details
//             await collection.updateOne(
//                 { id: post.id },
//                 { $set: { categories_details: categories, tags_details: tags, featured_media_details: featuredMedia } }
//             );

//             sendMessage(ws, `Updated post ID ${post.id} with additional details.`);
//         } catch (error) {
//             sendMessage(ws, `Error updating post ID ${post.id} with additional details: ${error.message}`);
//         }
//     }
// }

// async function checkIfMediaExists(ws, filename, token, destinationURL) {
//     try {
//         const response = await axios.get(`${destinationURL}/wp-json/wp/v2/media?search=${filename}`, {
//             headers: {
//                 'Authorization': `Basic ${token}`
//             }
//         });

//         if (response.data && response.data.length > 0) {
//             return response.data[0].id;  // Return the ID of the first matched media
//         }

//         return null;  // No match found
//     } catch (error) {
//         console.error(`Failed to fetch media ID: ${error}`);
//         return null;
//     }
// }


// async function uploadMediaToWordPress(ws, imageUrl, token, destinationURL) {

//     const filename = path.basename(imageUrl);

//     // First, check if the media item with the same filename already exists
//     const existingMediaId = await checkIfMediaExists(ws, filename, token, destinationURL);
//     if (existingMediaId) {
//         sendMessage(ws, `---Media with filename ${filename} already exists with ID: ${existingMediaId}`);
//         return existingMediaId;  // Return the ID of the existing media
//     }

//     try {
//         // Download the image from the URL to a buffer
//         const imageResponse = await axios.get(imageUrl, {
//             responseType: 'arraybuffer'
//         });
//         // console.log(imageResponse)

//         const imageType = imageResponse.headers['content-type'];
//         // console.log(imageType)

//         const response = await axios.post(
//             `${destinationURL}/wp-json/wp/v2/media`,
//             imageResponse.data,
//             {
//                 headers: {
//                     'Authorization': `Basic ${token}`,
//                     'Content-Type': imageType,
//                     'Content-Disposition': `attachment; filename=${path.basename(imageUrl)}`
//                 }
//             }
//         );

//         // console.log("response: " + response)

//         if (response.status === 201) {

//             sendMessage(ws, `--- Successfully uploaded image: ${filename} to WordPress`)
//             return response.data.id;
//         }
//     } catch (error) {
//         console.error(`Failed to upload media: ${error}`);
//         if (error.response && error.response.data) {
//             console.error(`Error details: ${JSON.stringify(error.response.data)}`);
//         }
//         return null;
//     }
// }


// async function pushPostsToWordPress(ws, destinationURL) {
//     // Assuming 'client', 'database', and 'dbCollection' variables are defined elsewhere
//     await client.connect();
//     const collection = client.db(database).collection(dbCollection);
//     const posts = await collection.find().toArray();

//     await client.close();

//     // Basic Authentication with Application Password
//     const username = process.env.DESTINATION_UN;
//     const appPassword = process.env.DESTINATION_APP_PASSWORD;
//     const token = Buffer.from(`${username}:${appPassword}`, 'utf8').toString('base64');

//     for (const post of posts) {

//         mediaId = null
//         if (post.featured_media_details && typeof post.featured_media_details === 'string') {
//             // For image uploading
//             const imageUrl = post.featured_media_details;
//             mediaId = await uploadMediaToWordPress(ws, imageUrl, token, destinationURL);
//         }

//         const categoryIds = [];
//         if (post.categories_details) {
//             let categoryNames = [];
//             if (enableCSVExport && typeof post.categories_details === 'string') {
//                 categoryNames = post.categories_details.split('|');
//             } else if (Array.isArray(post.categories_details)) {
//                 categoryNames = post.categories_details;
//             }

//             for (const categoryName of categoryNames) {
//                 let categoryId = await getTermIdByName(categoryName.trim(), 'category', token, destinationURL);
//                 if (!categoryId) {
//                     categoryId = await createTermInWordPress(categoryName.trim(), 'category', token, destinationURL);
//                 }
//                 if (categoryId) {
//                     categoryIds.push(categoryId);
//                 }
//             }
//         }
//         // if (post.categories_details && typeof post.categories_details === 'string') {
//         //     const categoryNames = post.categories_details.split('|');
//         //     for (const categoryName of categoryNames) {
//         //         let categoryId = await getTermIdByName(categoryName.trim(), 'category', token, destinationURL);
//         //         if (!categoryId) {
//         //             categoryId = await createTermInWordPress(categoryName.trim(), 'category', token, destinationURL);
//         //         }
//         //         if (categoryId) {
//         //             categoryIds.push(categoryId);
//         //         }
//         //     }

//         // }

//         const tagIds = [];
//         // if (post.tags_details && typeof post.tags_details === 'string') {
//         //     const tagNames = post.tags_details.split('|');
//         //     for (const tagName of tagNames) {
//         //         let tagId = await getTermIdByName(tagName.trim(), 'tag', token, destinationURL);
//         //         if (!tagId) {
//         //             tagId = await createTermInWordPress(tagName.trim(), 'tag', token, destinationURL);
//         //         }
//         //         if (tagId) {
//         //             tagIds.push(tagId);
//         //         }
//         //     }
//         // }
//         if (post.tags_details) {
//             let tagNames = [];
//             if (enableCSVExport && typeof post.tags_details === 'string') {
//                 tagNames = post.tags_details.split('|');
//             } else if (Array.isArray(post.tags_details)) {
//                 tagNames = post.tags_details;
//             }

//             for (const tagName of tagNames) {
//                 let tagId = await getTermIdByName(tagName.trim(), 'tag', token, destinationURL);
//                 if (!tagId) {
//                     tagId = await createTermInWordPress(tagName.trim(), 'tag', token, destinationURL);
//                 }
//                 if (tagId) {
//                     tagIds.push(tagId);
//                 }
//             }
//         }

//         const postData = {
//             title: post.title.rendered,
//             status: post.status,
//             slug: post.slug,
//             content: post.content.rendered,
//             excerpt: post.excerpt.rendered,
//             date: post.date,
//             categories: categoryIds.length > 0 ? categoryIds : undefined,  // If empty, don't include it
//             tags: tagIds.length > 0 ? tagIds : undefined,  // If empty, don't include it
//             featured_media: mediaId  // Set the media ID returned by the upload function
//         };

//         try {
//             const response = await axios.post(`${destinationURL}/wp-json/wp/v2/posts`, postData, {
//                 headers: {
//                     'Authorization': `Basic ${token}`,
//                     'Content-Type': 'application/json',
//                 }
//             });

//             if (response.status === 201) {
//                 // console.log(`Successfully pushed post ID ${post.id} with Title: ${post.title.rendered} to WordPress`);
//                 sendMessage(ws, `Successfully pushed post ID ${post.id}  with Title: <strong>${post.title.rendered}</strong> to WordPress`);
//             } else {
//                 // console.log(`Failed to push post ID ${post.id} with Title: ${post.title.rendered} to WordPress`);
//                 sendMessage(ws, `Failed to push post ID ${post.id} with Title: ${post.title.rendered} to WordPress`);
//             }
//         } catch (error) {
//             console.log(`An error occurred while pushing post ID ${post.id}: ${error}`);
//             sendMessage(ws, `An error occurred while pushing post ID ${post.id}: ${error}`);
//             if (error.response && error.response.data) {
//                 // Show more detail about the error
//                 console.log(`Error details: ${JSON.stringify(error.response.data)}`);
//                 sendMessage(ws, `Error details: ${JSON.stringify(error.response.data)}`);
//             }
//         }
//     }
// }

// async function getTermIdByName(termName, termType, token, destinationURL) {

//     // console.log('getTermIdByName function: ' + termName)
//     // return null

//     try {
//         const endpoint = termType === 'category' ? 'categories' : 'tags';
//         const response = await axios.get(`${destinationURL}/wp-json/wp/v2/${endpoint}?search=${termName}`, {
//             headers: {
//                 'Authorization': `Basic ${token}`
//             }
//         });

//         if (response.data && response.data.length > 0) {
//             return response.data[0].id;  // Return the ID of the first matched term
//         }

//         return null;  // No match found
//     } catch (error) {
//         console.error(`Failed to fetch ${termType} ID: ${error}`);
//         return null;
//     }
// }

// async function createTermInWordPress(termName, termType, token, destinationURL) {

//     // console.log('createTermInWordPress function: ' + termName)
//     // return null

//     try {
//         const endpoint = termType === 'category' ? 'categories' : 'tags';
//         const response = await axios.post(`${destinationURL}/wp-json/wp/v2/${endpoint}`, {
//             name: termName
//         }, {
//             headers: {
//                 'Authorization': `Basic ${token}`,
//                 'Content-Type': 'application/json'
//             }
//         });

//         if (response.data && response.data.id) {
//             return response.data.id;  // Return the ID of the created term
//         }

//         return null;  // Failed to create term
//     } catch (error) {
//         console.error(`Failed to create ${termType}: ${error}`);
//         return null;
//     }
// }



// async function fetchThePosts(ws, url, maxPosts = process.env.MAX_POSTS) {
//     const startTime = Date.now();
//     console.log('fetch posts function: ' + url)

//     // Start the timer on client side
//     ws.send("startTimer");

//     try {
//         sendMessage(ws, "Fetching posts...")
//         const allPosts = await fetchPosts(ws, url, maxPosts);

//         sendMessage(ws, "Delaying next process for 5 seconds...")
//         await sleep(5000);

//         sendMessage(ws, "Fetching additional details...")
//         const collection = client.db(database).collection(dbCollection);
//         await fetchAdditionalDetails(ws, allPosts, collection);

//         sendMessage(ws, "Delaying next process for 5 seconds...")
//         await sleep(5000);

//         if (enableCSVExport === 'true') {
//             sendMessage(ws, "Writing posts to XML...")
//             // await writePostsToCsv(ws);
//             await writePostsToXml(ws);

//             // console.log("All posts have been saved to XML");
//             sendMessage(ws, "All posts have been saved to XML")

//             sendMessage(ws, "Delaying next process for 5 seconds...")
//             await sleep(5000);

//         } else if (enableCSVExport === 'false') {
//             sendMessage(ws, "All posts have been saved to MongoDB")

//             sendMessage(ws, "Delaying next process for 5 seconds...")
//             await sleep(5000);
//         }

//         sendMessage(ws, "Pushing Post Data to WordPress")
//         await pushPostsToWordPress(ws, destinationURL);

//         sendMessage(ws, "Processing Post Data complete")

//     } catch (error) {
//         console.log('Error:', error);
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