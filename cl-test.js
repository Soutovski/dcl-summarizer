const cheerio = require('cheerio');

async function run() {
  const res = await fetch('https://www.cl.df.gov.br/diario-da-camara-legislativa');
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const forms = $('form').length;
  console.log('Forms on page:', forms);
  
  $('a:contains("Visualizar")').each((i, el) => {
    const link = $(el).attr('href');
    const rowText = $(el).closest('tr').text().replace(/\s+/g, ' ').trim();
    console.log(rowText, '->', link);
  });
}

run();
