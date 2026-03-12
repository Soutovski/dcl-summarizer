const cheerio = require('cheerio');

async function run() {
  const url = `https://www.cl.df.gov.br/diario-da-camara-legislativa`;
  
  const res = await fetch(url);
  const html = await res.text();
  console.log('HTML Length:', html.length);
  
  const $ = cheerio.load(html);
  
  const dateInputs = $('input[type="date"], input[name*="date"], input[name*="data"]').length;
  console.log('Date inputs found:', dateInputs);
  
  const forms = $('form').map((i, el) => $(el).attr('action')).get();
  console.log('Form Actions:', forms);
  
  // Try to find the advanced search URL if a form is targeting it
  $('form').each((i, form) => {
     console.log('Form', i, 'action:', $(form).attr('action'));
     $(form).find('input').each((j, input) => {
         console.log('  - Input:', $(input).attr('name'), 'type:', $(input).attr('type'));
     });
  });
}
run();
