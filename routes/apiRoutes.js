const express = require('express')
const router = express.Router()

const { getWebSocket } = require('../config/websocket')
const { processBuilder } = require('../functions/productsFromCsv')

// router.post('/api/posts/pull-to-csv', async (req, res) => {
//     const ws = getWebSocket()
//     const url = process.env.WP_API_URL
//     // console.log(url)
//     // return
//     if (ws) {
//         await fetchThePosts(ws, url)
//         res.status(200).json({ message: 'Posts fetched successfully' })
//     } else {
//         res.status(500).json({ message: 'No websocket connection' })
//     }
// });

// router.post('/api/posts/make-csv', async (req, res) => {
//     const ws = getWebSocket()
//     if (ws) {
//         await makeACsv(ws)
//         res.status(200).json({ message: 'Saved as CSV successfully' })
//     } else {
//         res.status(500).json({ message: 'No websocket connection' })
//     }
// })

router.post('/api/products/push-from-csv', async (req, res) => {
    const ws = getWebSocket()
    if (ws) {
        await processBuilder(ws)
        res.status(200).json({ message: 'Products pushed successfully' })
    } else {
        res.status(500).json({ message: 'No websocket connection' })
    }
})

module.exports = router;