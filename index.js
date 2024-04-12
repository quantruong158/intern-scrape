require('dotenv').config()
const axios = require('axios')
const nodemailer = require('nodemailer')
const { sql } = require('@vercel/postgres')

async function getDataFromApi() {
  try {
    const time = new Date().getTime()
    const response = await axios.get(`${process.env.WEBSITE_URL}${time}`)
    data = response.data
    return data.items
  } catch (error) {
    console.error('Error scraping website:', error)
    throw error
  }
}

async function sendEmailNotification(previous, current, data) {
  try {
    const { rows } = await sql`SELECT * FROM SUBSCRIBER`
    const emails = rows.map((row) => row.email)
    let transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PWD,
      },
    })
    const newComps = data.map((item) => item.fullname).join('<br/>')
    // Send mail with defined transport object
    const dif = current - previous
    let info = await transporter.sendMail({
      from: `"Intern Website Update Notification" <${process.env.GMAIL_USER}>`,
      to: emails,
      subject: `${dif} new internships added to the website!`,
      html: `The number of internships on the website has increased from ${previous} to <strong>${current}</strong>!<br/>${newComps}`,
    })

    console.log('Email sent:', info.response)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}
async function checkDataAndSendNotification(data) {
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
}

async function main() {
  try {
    const data = await getDataFromApi()
    await checkDataAndSendNotification(data)
    setInterval(async () => {
      const data = await getDataFromApi()
      await checkDataAndSendNotification(data)
    }, 60000 * 90)
  } catch (error) {
    console.error('Error in main function:', error)
  }
}

main()
