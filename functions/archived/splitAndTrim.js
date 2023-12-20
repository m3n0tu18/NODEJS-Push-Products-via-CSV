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
exports.splitAndTrim = splitAndTrim;
