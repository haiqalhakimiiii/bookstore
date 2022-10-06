const express = require('express')
const { ObjectId } = require('mongodb')
const { connectToDb, getDb } = require('./db')
const cors = require('cors')

// init app & middleware
const app = express()

// parse any json incoming request to be used in post handler function
app.use(express.json())

// cors
app.use(cors())


// db connection
let db
connectToDb((err) =>{
   if (!err){
      app.listen(3000, () => {
         console.log('listening on port 3000')
      })
      db = getDb()
   }
})

// routes
app.get('/books', (req,res) => {
   // pagination
   // const page = req.query.page || 0
   // const booksPerPage = 2
   // use skip or limit

   let books = []

   db.collection('books')
      .find()
      .sort({author: 1})
      // .skip(page * booksPerPage)
      // .limit(booksPerPage)
      .forEach(book => books.push(book))
      .then(() => {
         res.status(200).json(books)
      })
      .catch(() => {
         res.status(500).json({error: 'Could not fetch the documents'})
      })
})

// to find particular documents related to an id
app.get('/books/:id', (req,res) => {

   // verify objectid
   if (ObjectId.isValid(req.params.id)){
      db.collection('books')
         .findOne({_id: ObjectId(req.params.id)})
         .then(doc => {
            res.status(200).json(doc)
         })
         .catch(err => {
            res.status(500).json({error: 'Could not fetch particular documents'})
         })
   } else {
      res.status(500).json({error: 'Not a valid doc id'})
   }
})

// add a new book
app.post('/books', (req,res) => {
   const book = req.body
   console.log(book)

   db.collection('books')
      .insertOne(book)
      .then(result => {
         res.status(201).json(result)
      })
      .catch( err => {
         res.status(500).json({err: 'Could not create new document'})
      })
})

// delete a book
app.delete('/books/:id', (req,res) => {
   // verify objectid
   if (ObjectId.isValid(req.params.id)){
      db.collection('books')
         .deleteOne({_id: ObjectId(req.params.id)})
         .then(result => {
            res.status(200).json(result)
         })
         .catch(err => {
            res.status(500).json({error: 'Could not delete the document'})
         })
   } else {
      res.status(500).json({error: 'Not a valid doc id'})
   }
})

// update a certain part of book
app.patch('/books/:id', (req,res) => {
   const update = req.body
   console.log(update)
   // verify objectid
   if (ObjectId.isValid(req.params.id)){
      db.collection('books')
         .updateOne({_id: ObjectId(req.params.id)}, {$set: update})
         .then(result => {
            res.status(200).json(result)
         })
         .catch(err => {
            res.status(500).json({error: 'Could not update the document'})
         })
   } else {
      res.status(500).json({error: 'Not a valid doc id'})
   }
})
