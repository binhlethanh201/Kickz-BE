const mongoose = require('mongoose')
require('dotenv').config()
async function connect() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {dbName: process.env.DBNAME})
        console.log(`Connect to database ${process.env.DBNAME} successfully!`)
    } catch (error) {
        console.error(`Connection failed`, error)
        process.exit(1)
    }
}
module.exports = connect