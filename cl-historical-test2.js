const cheerio = require('cheerio');

async function run() {
  const targetDate = '10/03/2026';
  const url = `https://www.cl.df.gov.br/diario-da-camara-legislativa?dataLeitura=${targetDate}`;
  
  console.log('Fetching', url);
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  console.log('--- SEARCH RESULTS FOR', targetDate, '---');
  $('a').each((i, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.includes('Visualizar') || text.includes('DCL') || text.includes('Diário')) {
      const link = $(el).attr('href');
      console.log(text.substring(0, 80), '->', link);
    }
  });
}
run();
