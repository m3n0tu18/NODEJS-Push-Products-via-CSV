const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: process.env.WS_PORT })
let globalWs = null

wss.on('connection', (ws) => {
    globalWs = ws
    ws.on('message', (message) => {
        console.log(`Received message => ${message}`)
    })
    ws.send("...Websockets Connected...")
})

module.exports = {
    getWebSocket: () => globalWs
}