const mongoose = require('mongoose');
const { sendMessage } = require("./sendMessage");
const { uri, TempProduct } = require("./productsFromCsv");

// Get data from Database (UNUSED)


async function getDataFromDatabase(ws) {
    let results = [];
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
