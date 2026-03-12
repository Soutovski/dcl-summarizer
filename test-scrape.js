const cheerio = require('cheerio');

fetch('https://www.cl.df.gov.br/diario-da-camara-legislativa').then(r => r.text()).then(html => {
  const $ = cheerio.load(html);
  
  // Find "DCL do dia" text anywhere
  const dclDiaText = $('*').filter((i, el) => $(el).text().trim() === 'DCL do dia');
  console.log('Found DCL do dia nodes:', dclDiaText.length);
  
  // Find Visualizar link
  const viz = $('a').filter((i, el) => $(el).text().trim() === 'Visualizar').first();
  console.log('Visualizar A:', viz.attr('href'));
});
