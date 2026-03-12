const cheerio = require('cheerio');

async function run() {
  const url = `https://www.cl.df.gov.br/diario-da-camara-legislativa`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Look for pagination links which might contain the search/filter pattern
  console.log('--- PAGINATION PATTERNS ---');
  $('a[href*="delta="], a[href*="cur="], a[href*="p_p_id"]').each((i, el) => {
    console.log('Link:', $(el).attr('href'));
  });
  
  // Look for any hidden search JSON configs
  console.log('--- LIFERAY DATA ---');
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('Liferay.Search') || text.includes('searchBar')) {
      console.log('Search config found:', text.substring(0, 150));
    }
  });
}
run();
