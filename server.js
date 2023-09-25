if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: './env/dev.env' })
}

const express = require('express')
const app = express()
app.set('view engine', 'ejs')
const initializeMiddlewares = require('./config/middlewares')
const apiRoutes = require('./routes/apiRoutes')
const { getWebSocket } = require('./config/websocket')


initializeMiddlewares(app)

app.use(apiRoutes)

app.use(express.static('public'))


app.get('/', (req, res) => {
    const wsPort = process.env.WS_PORT
    res.render('index', { wsPort: wsPort })
})


const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Server is up on port ${port}`)
})