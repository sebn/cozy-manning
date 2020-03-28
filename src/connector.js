const {
  requestFactory,
  saveFiles,
  signin,
  scrape,
  log
} = require('cozy-konnector-libs')

const baseUrl = 'https://www.manning.com'

var start = async fields => {
  log('info', 'Authenticating...')
  await login(fields)

  log('info', 'Loading dashboard...')
  const $ = await loadDashboard()

  log('info', 'Scraping products...')
  const products = scrapeProducts($)

  log('info', `Scraping downloads...`)
  const downloads = scrapeDownloads($, products)

  log('info', 'Saving files...')
  saveFiles(downloads, fields)
}

var login = fields =>
  signin({
    url:
      'https://login.manning.com/login?service=https%3A%2F%2Fwww.manning.com%2Flogin%2Fcas',
    formSelector: '#fm1',
    formData: {
      username: fields.login,
      password: fields.password
    }
  })

var loadDashboard = () => request(baseUrl + '/dashboard')

var scrapeProducts = $ => {
  const downloadSelector = {
    sel: '.downloads-and-more div[data-target]',
    attr: 'data-target'
  }

  return scrape(
    $,
    {
      title: '.product-title',
      lastUpdated: {
        sel: '.meap-last-updated',
        parse: str =>
          str
            .split(':')
            .pop()
            .trim()
      },
      downloadSelector,
      externalId: {
        ...downloadSelector,
        parse: str => str.split('-').pop()
      }
    },
    '#productTable tr'
  )
}

var scrapeDownloads = ($, products) =>
  products.reduce(
    (previousDownloads, product) =>
      previousDownloads.concat(scrapeDownloadsByProduct($, product)),
    []
  )

var scrapeDownloadsByProduct = ($, product) => {
  const $form = $(`${product.downloadSelector} form`)
  const downloadIds = scrapeDownloadIds($, product)
  const downloads = downloadIds.map(scrapeDownloadById($form, product))
  return downloads
}

var scrapeDownloadById = ($form, product) => id => ({
  fileurl: baseUrl + $form.attr('action'),
  filename: `${product.title}.${downloadExt($form, id)}`,
  requestOptions: {
    method: $form.attr('method'),
    form: {
      ...formData($form),
      [downloadIdsKey(product)]: id
    }
  }
})

var downloadExt = ($form, id) => {
  const format = $form
    .find(`input[value="${id}"]`)
    .parent('label')
    .text()
    .trim()

  switch (format) {
    case 'kindle':
      return 'mobi'
    default:
      return format
  }
}

var formData = $form =>
  $form
    .serializeArray()
    .reduce(
      (object, { name, value }) => Object.assign(object, { [name]: value }),
      {}
    )

var scrapeDownloadIds = ($, product) =>
  $(`${product.downloadSelector} input[name=${downloadIdsKey(product)}]`)
    .map((_, element) => $(element).attr('value'))
    .get()

var downloadIdsKey = product => `${product.externalId}-restrictedDownloadIds`

var request = requestFactory({
  // debug: true,
  cheerio: true,
  json: false,
  jar: true
})

module.exports = {
  downloadExt,
  downloadIdsKey,
  formData,
  loadDashboard,
  login,
  scrapeProducts,
  scrapeDownloadById,
  scrapeDownloadIds,
  scrapeDownloads,
  scrapeDownloadsByProduct,
  start
}
