const express = require('express')
const { inngest, func } = require('./inngest/internChecker')
const { serve } = require('inngest/express')

require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware to parse JSON bodies
app.use(express.json())

app.use('/api/inngest', serve({ client: inngest, functions: [func] }))
// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})
