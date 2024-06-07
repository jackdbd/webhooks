import fs from 'node:fs'
import path from 'node:path'

// const secrets_dirpath = path.join(process.cwd(), "secrets");

// const json_filepaths = fs
//   .readdirSync(secrets_dirpath)
//   .filter((rfp) => rfp.endsWith(".json"))
//   .map((rfp) => path.join(secrets_dirpath, rfp));

// const txt_filepaths = fs
//   .readdirSync(secrets_dirpath)
//   .filter((rfp) => rfp.endsWith(".txt"))
//   .map((rfp) => path.join(secrets_dirpath, rfp));

// const strings = [];

// json_filepaths.forEach((fp) => {
//   const key = path.basename(fp, ".json").toUpperCase().replaceAll("-", "_");
//   const s = fs.readFileSync(fp).toString();
//   const value = s.replaceAll("\n", "").replaceAll(" ", "");
//   // return `${key}=${value}`;
//   strings.push(`${key}=${value}`);
// });

// txt_filepaths.forEach((fp) => {
//   const key = path.basename(fp, ".txt").toUpperCase().replaceAll("-", "_");
//   const s = fs.readFileSync(fp).toString();
//   const value = s.replaceAll("\n", "").replaceAll(" ", "");
//   strings.push(`${key}=${value}`);
// });

const kv = ({ key, json = undefined, value = undefined }) => {
  if (value) {
    return `${key}=${value}`
  }

  if (!json && !json.filepath) {
    throw new Error(`specify either a value or a json.filepath for ${key}`)
  }

  const s = fs.readFileSync(json.filepath).toString()
  let val = s.replaceAll('\n', '').replaceAll(' ', '')
  if (json.lens) {
    val = json.lens(JSON.parse(val))
  }
  return `${key}=${val}`
}

const main = () => {
  const strings = [
    kv({
      key: 'CAL_WEBHOOK_SECRET',
      json: { filepath: '/run/secrets/cal', lens: (m) => m.webhook_secret }
    }),
    kv({
      key: 'CLOUDINARY_API_KEY',
      json: { filepath: '/run/secrets/cloudinary', lens: (m) => m.api_key }
    }),
    kv({
      key: 'CLOUDINARY_WEBHOOK_SECRET',
      json: {
        filepath: '/run/secrets/cloudinary',
        lens: (m) => m.webhook_secret
      }
    }),
    kv({
      key: 'NPM_WEBHOOK_SECRET',
      json: {
        filepath: '/run/secrets/npm',
        lens: (m) => m.webhook_secret
      }
    }),
    kv({
      key: 'STRIPE_API_KEY',
      json: {
        filepath: '/run/secrets/stripe/personal/test',
        lens: (m) => m.api_key
      }
    }),
    kv({
      key: 'STRIPE_WEBHOOK_SECRET',
      json: {
        filepath: '/run/secrets/stripe/personal/test',
        lens: (m) => m.webhook_secret
      }
    }),
    kv({
      key: 'TELEGRAM',
      json: {
        filepath: '/run/secrets/telegram/personal_bot'
      }
    })
  ]

  // https://developers.cloudflare.com/workers/platform/environment-variables/
  const outpath = path.join(process.cwd(), '.dev.vars')

  fs.writeFileSync(outpath, strings.join('\n'), 'utf8')
  console.log(`✅ ${outpath} generated`)
}

main()
