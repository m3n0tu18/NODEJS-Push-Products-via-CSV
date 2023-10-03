# NODEJS-Push-Products-via-CSV


### .env files
.env located in the /env/dev.env file.

```
SESSION_SECRET=
DELAY_TIMEOUT=2000
PORT=3001
WS_PORT=8024
MONGO_URL=mongodb://127.0.0.1:27017
DATABASE=database_name
COLLECTION=collection_name

WP_DESTINATION_URL=http://example.com
WC_CONSUMER_KEY=
WC_CONSUMER_SECRET=
WC_API_VERSION='wc/v3'
```

### TODO 

1. Error correction, cross check to see whether the product is already within the system and update rather than overwrite.
2. flush the database after it has completed the upload. Also remove the temp file that has been uploaded.
3. Add non variable true attributes.
4. Update the verboseness of the logbox so that it is a bit more user friendly on its progress. EG: batch of 100 variations processed etc.
5. Implement csv upload feature that will cross check to make sure that the columns that are required are in there. If they are then proceed to save the csv to a local file for processing. If not error out saying that its missing columns name xx yy zz and dont allow further uploads until its got the fields.
6. Add a template csv file to allow downloading for user interfacing.
7. Add a login screen so prevent unauthorised access. locking down the csv pusher.
8. Deploy to a test environment.


## Process Products from CSV


## Order Management.
This is located in functions/orderManagement.js

It will require some extra work but it allows the user to pull down the amount of orders older than 2 years after todays date, verify how many there are, save the complete woocommerce order list to a mongoDB database and then methodically batch remove all of the orders.

To Note: you may need to change line 155 to page: pages from page: 1 for the batch deletion if the first way doesn't work.

Here is the whole old function:

```
async function removeOldOrdersFromWooCommerce() {
    // Calculate the date that is exactly 2 years from today
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString();

    console.log(`Removing WooCommerce orders older than ${cutoffDate}...`);

    let page = 1;
    const maxRetries = 5; // Number of times to retry after a failure
    const retryDelay = 30000; // 30 seconds delay between retries

    while (true) {
        let retries = 0;
        while (retries < maxRetries) {
            try {
                const response = await WooCommerce.get("orders", {
                    per_page: 100,
                    page: page,
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

                console.log(`Successfully deleted ${deletedOrders.length} orders from page ${page}.`);
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

        page++;
    }
}
```