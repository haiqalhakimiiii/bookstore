const {MongoClient} = require('mongodb')

let dbConnection

module.exports = {

   // establish connection to database
   connectToDb: (cb) => {
      MongoClient.connect('mongodb://localhost:27017/bookstore')
         .then((client) => {
            dbConnection = client.db()
            return cb()
         })
         .catch((err) => {
            console.log(err)
            return cb(err)
         })
   },

   // return a value which is db connection
   getDb:() => dbConnection
}