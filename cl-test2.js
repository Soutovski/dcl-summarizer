const cheerio = require('cheerio');
async function run() {
  const res = await fetch('https://www.cl.df.gov.br/diario-da-camara-legislativa');
  const html = await res.text();
  const $ = cheerio.load(html);
  
  a.each((i, el) => {
    const text = .text().trim();
    if (text.includes('Visualizar') || text.includes('DCL')) {
      const link = .attr('href');
      console.log(text.substring(0, 50), '->', link);
    }
  });
}
run();
