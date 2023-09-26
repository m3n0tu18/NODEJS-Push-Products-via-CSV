require("dotenv").config();
// const MongoClient = require('mongodb').MongoClient;


const dbCollection = process.env.COLLECTION;
const database = process.env.DATABASE;
const uri = `${process.env.MONGO_URL}/${database}`;
const delayTimeout = process.env.DELAY_TIMEOUT;
const destinationURL = process.env.WP_DESTINATION_URL;
const mongoose = require('mongoose');
const axios = require("axios");
const Buffer = require('buffer').Buffer;
const { send } = require('express/lib/response');
const xml2js = require('xml2js');
const path = require('path');
const fs = require('fs')
const csv = require('csvtojson');  // Move this to the top of your file for better performance

const WooCommerce = require("@woocommerce/woocommerce-rest-api").default

// const WooCommerce = new WooCommerceRestApi({
//     url: process.env.WOO_WEBSITE_URL,
//     consumerKey: process.env.WOO_CONSUMER_KEY,
//     consumerSecret: process.env.WOO_CONSUMER_SECRET,
//     version: process.env.WOO_API_VERSION,
//     queryStringAuth: true,
// });

// data cleaner upper (used in schema)
function splitAndTrim(value) {
    return typeof value === 'string' ? value.split('|').map(item => item.trim()) : value;
}

// Mongo DB Schema
const productSchema = new mongoose.Schema({
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

// Mongo DB Model
const Product = mongoose.model('Product', productSchema, 'csvProductData');

// Websocket Sender function
function sendMessage(ws, message) {
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(message);
    }
}

// Sleeper function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Function to convert CSV to MongoDB
async function convertCSVToMongo(ws) {
    const csvFilePath = './csv_data/tubular-data-updated.csv';

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
            const result = await Product.updateOne(
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


// Get data from Database
async function getDataFromDatabase(ws) {
    let results = []
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

        // Fetching data from MongoDB
        results = await Product.find({});

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

// Function to check WooCommerce for existing products
async function checkIfProductExists(ws, sku, token, destinationURL) {
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Making a GET request to WooCommerce to find the product by SKU
        const response = await axios.get(`${destinationURL}/wp-json/wc/v3/products`, {
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

// Extract and group terms from database to new collection
async function extractAttributes(ws) {
    // Connect to MongoDB
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    // Fields to extract from the database
    const fields = ["Accessories", "Baffle Colour", "Beam Angle", "Body Colour", "Colour Temperature", "Cut-Out", "Dimming", "IP Rating", "Lumen Output", "Socket Type", "Wattage", "mA"];

    // Fetch only the desired fields from MongoDB
    const products = await Product.find({}, fields).lean().exec();

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
                                values: []
                            });
                        }
                    }

                    // If value is not in cache, add to both cache and database
                    if (!attributeCache[attribute].has(attrVal)) {
                        attributeCache[attribute].add(attrVal);
                        await attributes.updateOne(
                            { name: attribute },
                            { $push: { values: attrVal } }
                        );
                    }
                }
            }
        }
    }
}


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

// Function to fetch all results from WooCommerce with pagination
async function fetchAllFromWooCommerce(endpoint, WooCommerceAPI) {
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

async function addOrUpdateGlobalAttributes(ws, destinationURL) {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const attributes = mongoose.connection.collection('product_attributes');
    const allAttributes = await attributes.find({}).toArray();

    const WooCommerceAPI = new WooCommerce({
        url: destinationURL,
        consumerKey: process.env.WC_CONSUMER_KEY,
        consumerSecret: process.env.WC_CONSUMER_SECRET,
        wpAPI: true,
        version: 'wc/v3',
        queryStringAuth: true
    });

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
            for (const existingTerm of existingTerms) {
                if (!attr.values.includes(existingTerm.name)) {
                    try {
                        await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}/terms/${existingTerm.id}`);
                    } catch (err) {
                        console.error(`Error deleting term "${existingTerm.name}": ${err.message}`);
                    }
                }
            }

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
    for (const existingAttribute of existingAttributes) {
        if (!allAttributes.some(attr => attr.name.toLowerCase() === existingAttribute.slug)) {
            try {
                await WooCommerceAPI.delete(`products/attributes/${existingAttribute.id}`);
            } catch (err) {
                console.error(`Error deleting attribute "${existingAttribute.slug}": ${err.message}`);

            }
        }
    }

    mongoose.connection.close();
}






// Run the Process
async function processBuilder(ws) {
    const startTime = Date.now();
    ws.send("startTimer");

    try {
        await sleep(delayTimeout);
        sendMessage(ws, "Fetching products from CSV...")
        await sleep(delayTimeout);
        await convertCSVToMongo(ws); // WORKS

        // const filter = { "SKU": "TUB-1-1-1" }
        // const getData = await getDataFromDatabase(ws, filter)
        await sleep(delayTimeout);
        sendMessage(ws, "Extracting attributes to new collection")
        await extractAttributes(ws)

        await sleep(delayTimeout)
        sendMessage(ws, "Adding global attributes to WooCommerce")
        await addOrUpdateGlobalAttributes(ws, destinationURL)
        // console.log(getData)
        // sendMessage(ws, getData)
        sendMessage(ws, "Process completed...")
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


// ::REFERENCE MATERIAL::


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