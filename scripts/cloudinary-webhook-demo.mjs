import fs from 'node:fs'
import path from 'node:path'
import { v2 as cloudinary } from 'cloudinary'

const waitMs = async (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ message: `resolved in ${ms} ms` })
    }, ms)
  })
}

const webhooks_dirpath = path.join(
  process.cwd(),
  'assets',
  'webhook-events',
  'cloudinary'
)

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME
const api_key = process.env.CLOUDINARY_API_KEY
const api_secret = process.env.CLOUDINARY_API_SECRET

cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
  secure: true
})

// https://cloudinary.com/documentation/notifications#verifying_notification_signatures

const main = async () => {
  const filepath = path.join(webhooks_dirpath, 'image-uploaded.json')
  // data can be either a Buffer or a string, but NOT a parsed JSON object
  // const buf = fs.readFileSync(filepath)
  const json_string = fs.readFileSync(filepath).toString()
  //   const obj = JSON.parse(fs.readFileSync(filepath).toString())

  // Unix timestamp in seconds. Can be retrieved from the X-Cld-Timestamp header
  const x_cld_timestamp = Math.floor(new Date().getTime() / 1000)

  //   const options = { cloud_name, api_key, api_secret }
  const options = {}

  // Actual signature. Can be retrieved from the X-Cld-Signature header
  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#LL1066C10-L1066C64
  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/test/utils/utils_spec.js#L1486
  // The hash is a hex string, computed using: data + timestamp + api_secret
  const x_cld_signature = cloudinary.utils.webhook_signature(
    json_string,
    x_cld_timestamp,
    options
  )

  console.log(`X-Cld-Signature: ${x_cld_signature}`)
  console.log(`X-Cld-Timestamp: ${x_cld_timestamp}`)

  // re-read the file because to simulate a POST request sent over a network and
  // received by a route handler
  const request_body_as_string = fs.readFileSync(filepath).toString()

  //   let valid_for = 2 // in seconds
  //   const valid_for = 4 // in seconds

  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1075
  const valid_for = undefined // the default is 7200 seconds

  const { message } = await waitMs(3000)
  console.log(message)

  const valid = cloudinary.utils.verifyNotificationSignature(
    request_body_as_string,
    x_cld_timestamp,
    x_cld_signature,
    valid_for
  )
  console.log(`is signature valid?`, valid)
}

main()
