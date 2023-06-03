import path from 'node:path'
import { v2 as cloudinary } from 'cloudinary'

const images_dirpath = path.join(process.cwd(), 'assets', 'images')

const filepath = path.join(images_dirpath, 'cal-webhooks.png')

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME
const api_key = process.env.CLOUDINARY_API_KEY
const api_secret = process.env.CLOUDINARY_API_SECRET

cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
  secure: true
})

const main = async () => {
  // https://cloudinary.com/documentation/notifications#verifying_notification_signatures
  const notification_url = 'https://webhooks.giacomodebidda.com/cloudinary'

  cloudinary.uploader
    .upload(filepath, { notification_url })
    .then((result) => {
      console.log(`result`, result)
    })
    .catch((err) => {
      console.log(`err`, err)
    })
}

main()
