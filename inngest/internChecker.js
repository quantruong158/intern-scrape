const { Inngest } = require('inngest')
const axios = require('axios')
const nodemailer = require('nodemailer')
const { sql } = require('@vercel/postgres')

const inngest = new Inngest({ id: 'my-app' })

const func = inngest.createFunction(
  { id: 'hourly-intern-check' }, // The name of your function, used for observability.
  { cron: '*/30 * * * *' }, // The cron syntax for the function. TZ= is optional.

  // This function will be called on the schedule above
  async ({ step }) => {
    return await checkIntern() // You can write whatever you want here.
  }
)

// Function to fetch data from the API
async function fetchDataFromApi() {
  try {
    const time = new Date().getTime()
    const response = await axios.get(`${process.env.WEBSITE_URL}${time}`)
    return response.data.items
  } catch (error) {
    console.error('Error fetching data from API:', error)
    throw error
  }
}

// Function to send email notification
async function sendEmailNotification(previous, current, data) {
  try {
    const { rows } = await sql`SELECT * FROM SUBSCRIBER`
    const bccList = rows.map((row) => row.email).join(',')
    let transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PWD,
      },
    })
    const newComps = data.map((item) => '<li>' + item.fullname + '</li>').join('')
    // Send mail with defined transport object
    const dif = current - previous
    let info = await transporter.sendMail({
      from: `"Intern Website Update Notification" <${process.env.GMAIL_USER}>`,
      bcc: bccList,
      subject: `${dif} new internships added to the website!`,
      html: `The number of internships on the website has increased from ${previous} to <strong>${current}</strong>!<br/><ul>${newComps}</ul>`,
    })

    console.log('Email sent:', info.response)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

// Function to check data and send notification
async function checkDataAndSendNotification(data) {
  try {
    const { rows } = await sql`SELECT name, website_id FROM COMPANY`
    const currentCount = rows.length
    const newCount = data.length
    const newComps = []
    if (newCount > currentCount) {
      for (const item of data) {
        const match = rows.find((row) => row.website_id === item._id)
        if (!match) {
          await sql`INSERT INTO COMPANY (name, website_id) VALUES (${item.fullname}, ${item._id})`
          newComps.push(item)
        }
      }
      await sendEmailNotification(currentCount, newCount, newComps)
    }
  } catch (error) {
    console.error('Error checking data and sending notification:', error)
    throw error
  }
}

// Main function to orchestrate data fetching and notification
async function checkIntern() {
  try {
    console.log('Checking for new internships...')
    const data = await fetchDataFromApi()
    await checkDataAndSendNotification(data)
  } catch (error) {
    console.error('Error in main function:', error)
  }
}

module.exports = { inngest, func }
