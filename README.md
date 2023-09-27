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