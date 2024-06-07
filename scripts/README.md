# scripts

Scripts I use for various admin tasks.

## cloudinary-upload.mjs

Upload an image to Cloudinary.

```sh
node cloudinary-upload.mjs
```

## make-dev-vars.mjs

Generate the `.dev.vars` file [required when developing locally](https://developers.cloudflare.com/workers/configuration/secrets/#secrets-in-development) with `wrangler dev` and `wrangler pages dev`.

```sh
node make-dev-vars.mjs
```
