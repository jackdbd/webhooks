import fs from 'node:fs'
import path from 'node:path'
import { v2 as cloudinary } from 'cloudinary'

const images_dirpath = path.join(process.cwd(), 'assets', 'images')
const filepath = path.join(images_dirpath, 'cal-webhooks.png')

const main = async () => {
  // https://cloudinary.com/documentation/notifications#verifying_notification_signatures
  const notification_url = 'https://webhooks.giacomodebidda.com/cloudinary'

  const s = fs.readFileSync('/run/secrets/cloudinary').toString()
  const { api_key, api_secret, cloud_name } = JSON.parse(s)

  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true
  })

  cloudinary.uploader
    .upload(filepath, { notification_url })
    .then((result) => {
      console.log(`Cloudinary upload result`, result)
    })
    .catch((err) => {
      console.log(`Cloudinary upload error`, err)
    })
}

main()
