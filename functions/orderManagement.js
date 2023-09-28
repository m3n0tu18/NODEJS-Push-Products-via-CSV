const { MongoClient } = require("mongodb");
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
// import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api"; // Supports ESM

const WooCommerce = new WooCommerceRestApi({
    url: "https://www.hampshiregenerators.co.uk/",
    consumerKey: "ck_08d572715114a6b7d6f462b741ad85240ee3b5e2",
    consumerSecret: "cs_fff26bc35b70808396f558d003c9eb4d20345387",
    version: "wc/v3",
    queryStringAuth: true,
});

// async function saveBatchToMongo(client, orders) {
//     const dbName = "hampshireGensMongOrderDBNew";
//     const db = client.db(dbName);
//     const collection = db.collection('orders');
//     console.log("Inserting orders batch...");
//     await collection.insertMany(orders);
//     console.log("Batch inserted successfully");
// }

async function saveBatchToMongo(client, orders) {
    const dbName = "hampshireGensMongOrderDBNew";
    const db = client.db(dbName);
    const collection = db.collection('orders');
    console.log("Inserting orders batch...");

    // Fetch existing order IDs from the batch in MongoDB
    const orderIds = orders.map(order => order.id);
    const existingOrders = await collection.find({ id: { $in: orderIds } }).toArray();
    const existingOrderIds = existingOrders.map(order => order.id);

    // Filter out orders that already exist in MongoDB
    const ordersToInsert = orders.filter(order => !existingOrderIds.includes(order.id));

    if (ordersToInsert.length > 0) {
        await collection.insertMany(ordersToInsert);
        console.log(`Inserted ${ordersToInsert.length} orders.`);
    } else {
        console.log("All orders in the current batch already exist in the database. Skipping...");
    }
}

// async function fetchAndSaveOrders() {
//     const url = "mongodb://127.0.0.1:27017"; 
//     const client = new MongoClient(url, { useUnifiedTopology: true });
//     await client.connect();
//     console.log("Connected correctly to server");

//     let page = 1;
//     while (true) {
//         try {
//             console.log(`Fetching page ${page}...`);
//             const response = await WooCommerce.get("orders", {
//                 per_page: 100,
//                 page: page
//             });
//             if (response.data.length === 0) {
//                 console.log("No more orders found.");
//                 break;
//             }
//             await saveBatchToMongo(client, response.data);
//             page++;
//         } catch (error) {
//             console.log("Error while fetching or saving orders:", error.response ? error.response.data : error);
//             break;
//         }
//     }

//     await client.close();
//     console.log("MongoDB connection closed");
// }

async function fetchAndSaveOrders() {
    const url = "mongodb://127.0.0.1:27017";
    const client = new MongoClient(url, { useUnifiedTopology: true });
    const maxRetries = 5; // Number of times to retry after a failure
    const retryDelay = 30000; // 30 seconds delay between retries

    let retries = 0;
    while (retries < maxRetries) {
        try {
            await client.connect();
            console.log("Connected correctly to server");
            retries = maxRetries; // Exit the retry loop if the connection is successful
        } catch (error) {
            console.log("Error connecting to MongoDB:", error);
            if (retries < maxRetries - 1) {
                console.log(`Retrying in ${retryDelay / 1000} seconds... (Attempt ${retries + 2} of ${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            retries++;
        }
    }

    let page = 1;
    while (true) {
        try {
            console.log(`Fetching page ${page}...`);
            const response = await WooCommerce.get("orders", {
                per_page: 100,
                page: page
            });
            if (response.data.length === 0) {
                console.log("No more orders found.");
                break;
            }
            await saveBatchToMongo(client, response.data);
            page++;
        } catch (error) {
            console.log("Error while fetching or saving orders:", error.response ? error.response.data : error);
            break;
        }
    }

    await client.close();
    console.log("MongoDB connection closed");
}

// UNTESTED FUNCTION:
// async function removeOldOrdersFromWooCommerce() {
//     // Calculate the date that is exactly 2 years from today
//     const twoYearsAgo = new Date();
//     twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
//     // const cutoffDate = twoYearsAgo.toISOString().split('T')[0];
//   const cutoffDate = twoYearsAgo.toISOString();

//     console.log(`Removing WooCommerce orders older than ${cutoffDate}...`);

//   // return
//     let page = 1;
//     while (true) {
//         try {
//             const response = await WooCommerce.get("orders", {
//                 per_page: 100,
//                 page: page,
//                 before: cutoffDate  // Changed from 'after' to 'before'
//             });

//             if (response.data.length === 0) {
//                 console.log("No more orders found. Exiting loop.");
//                 break;
//             }

//             for (let order of response.data) {
//                 try {
//                     await WooCommerce.delete(`orders/${order.id}`, { force: true });
//                     console.log(`Successfully deleted order ID: ${order.id}`);
//                 } catch (err) {
//                     console.log(`Error deleting order ID: ${order.id}. Error: ${err.message || err}`);
//                 }
//             }

//             page++;

//         } catch (error) {
//             console.log("Error while fetching or deleting orders:", error.response ? error.response.data : error);
//             break;
//         }
//     }
// }

// async function removeOldOrdersFromWooCommerce() {
//     // Calculate the date that is exactly 2 years from today
//     const twoYearsAgo = new Date();
//     twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
//     const cutoffDate = twoYearsAgo.toISOString();

//     console.log(`Removing WooCommerce orders older than ${cutoffDate}...`);

//     let page = 1;
//     while (true) {
//         try {
//             const response = await WooCommerce.get("orders", {
//                 per_page: 100,
//                 page: page,
//                 before: cutoffDate
//             });

//             if (response.data.length === 0) {
//                 console.log("No more orders found. Exiting loop.");
//                 break;
//             }

//             const orderIdsToDelete = response.data.map(order => order.id);

//             const batchData = {
//                 delete: orderIdsToDelete
//             };

//             const deleteResponse = await WooCommerce.post("orders/batch", batchData);
//             const deletedOrders = deleteResponse.data.delete || [];

//             console.log(`Successfully deleted ${deletedOrders.length} orders from page ${page}.`);

//             page++;

//         } catch (error) {
//             console.log("Error while fetching or deleting orders:", error.response ? error.response.data : error);
//             break;
//         }
//     }
// }
async function removeOldOrdersFromWooCommerce() {
    // Calculate the date that is exactly 2 years from today
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString();

    console.log(`Removing WooCommerce orders older than ${cutoffDate}...`);

    const maxRetries = 5; // Number of times to retry after a failure
    const retryDelay = 30000; // 30 seconds delay between retries
    let batchCount = 1; // To track the number of batches processed

    while (true) {
        let retries = 0;
        while (retries < maxRetries) {
            try {
                const response = await WooCommerce.get("orders", {
                    per_page: 100,
                    page: 1, // Always request the first page
                    before: cutoffDate
                });

                if (response.data.length === 0) {
                    console.log("No more orders found. Exiting loop.");
                    return; // Exit the function
                }

                const orderIdsToDelete = response.data.map(order => order.id);

                const batchData = {
                    delete: orderIdsToDelete
                };

                const deleteResponse = await WooCommerce.post("orders/batch", batchData);
                const deletedOrders = deleteResponse.data.delete || [];

                console.log(`Successfully deleted ${deletedOrders.length} orders from batch ${batchCount}.`);
                batchCount++;
                break; // Break out of the retry loop if successful

            } catch (error) {
                console.log("Error while fetching or deleting orders:", error.response ? error.response.data : error);
                if (retries < maxRetries - 1) { // Don't log the final retry attempt
                    console.log(`Retrying in ${retryDelay / 1000} seconds... (Attempt ${retries + 2} of ${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
                }
                retries++;
            }
        }

        if (retries >= maxRetries) {
            console.log("Max retries reached. Exiting.");
            return; // Exit the function after max retries
        }
    }
}



async function verifyOrdersBeforeDeletion() {
    // Calculate the date that is exactly 2 years from today
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString();

    console.log(`Fetching WooCommerce orders older than ${cutoffDate} for verification...`);

    let page = 1;
    let totalOrders = 0;
    while (true) {
        try {
            const response = await WooCommerce.get("orders", {
                per_page: 100,
                page: page,
                before: cutoffDate
            });

            if (response.data.length === 0) {
                console.log("No more orders found. Exiting loop.");
                break;
            }

            for (let order of response.data) {
                console.log(`Order ID: ${order.id}, Date: ${order.date_created}, Status: ${order.status}`);
                totalOrders++;
            }

            page++;

        } catch (error) {
            console.log("Error while fetching orders:", error.response ? error.response.data : error);
            break;
        }
    }
    console.log(`Total orders older than ${cutoffDate}: ${totalOrders}`);
}

// Below function will download all orders and push to MongoDB

(async () => {
    const startTime = Date.now();
    try {
        await fetchAndSaveOrders();
        //         await verifyOrdersBeforeDeletion();
        //         await removeOldOrdersFromWooCommerce();

        console.log("Old order removal completed.");

    } catch (err) {
        console.log("Error: ", err);
    }
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime);

    const hours = Math.floor(elapsedTime / 3600000);
    const minutes = Math.floor((elapsedTime - (hours * 3600000)) / 60000);
    const seconds = Math.floor((elapsedTime - (hours * 3600000) - (minutes * 60000)) / 1000);

    console.log(`Elapsed time: ${hours} hours, ${minutes} minutes, ${seconds} seconds`);
})();