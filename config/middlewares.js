const express = require('express')
const expressLayouts = require('express-ejs-layouts')
const session = require('express-session')
const methodOverride = require('method-override')
const path = require('path')
const flash = require('express-flash')


module.exports = (app) => {
    const cors = require('cors')
    app.use(cors())
    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))
    app.use(expressLayouts)
    app.set('view engine', 'ejs')
    app.use(express.static('public'))
    app.use(methodOverride('_method'))
    app.use(flash())
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    }))

    app.set('layout', './layouts/base')
}