// const Product = mongoose.model('Product', productSchema, 'wooCommerceProducts')
// Websocket Sender function (USED AND WORKS)
function sendMessage(ws, message) {
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(message);
    }
}
exports.sendMessage = sendMessage;
