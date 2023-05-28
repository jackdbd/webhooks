import npmPlugin from './_plugin.js'

export const onRequestPost = [npmPlugin({ shouldValidate: false })]
