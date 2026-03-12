const cheerio = require('cheerio');

async function run() {
  const url = `https://www.cl.df.gov.br/diario-da-camara-legislativa`;
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Liferay form action
  const actionUrl = $('#_com_liferay_dynamic_data_mapping_form_web_portlet_DDMFormPortlet_INSTANCE_fnbsb6SEY8TI_fm').attr('action');
  console.log('Action URL:', actionUrl);
  
  if (!actionUrl) {
     console.log('Form not found.');
     return;
  }
  
  const formData = new URLSearchParams();
  
  // Extract all hidden inputs required for Liferay forms to work
  $('#_com_liferay_dynamic_data_mapping_form_web_portlet_DDMFormPortlet_INSTANCE_fnbsb6SEY8TI_fm input[type="hidden"]').each((i, el) => {
    formData.append($(el).attr('name'), $(el).attr('value') || '');
  });
  
  // The actual search parameters we found previously
  formData.append('_com_liferay_dynamic_data_mapping_form_web_portlet_DDMFormPortlet_INSTANCE_fnbsb6SEY8TI_dataLeitura', '10/03/2026');
  formData.append('_com_liferay_dynamic_data_mapping_form_web_portlet_DDMFormPortlet_INSTANCE_fnbsb6SEY8TI_formDate', new Date().getTime());

  console.log('Sending POST to form...');
  const postRes = await fetch(actionUrl, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': res.headers.get('set-cookie') || ''
    }
  });

  const postHtml = await postRes.text();
  const $res = cheerio.load(postHtml);
  
  console.log('--- POST SEARCH RESULTS FOR 10/03/2026 ---');
  $res('a').each((i, el) => {
    const text = $res(el).text().trim().replace(/\s+/g, ' ');
    if (text.includes('Visualizar') || text.includes('DCL') || text.includes('Diário')) {
      const link = $res(el).attr('href');
      console.log(text.substring(0, 80), '->', link);
    }
  });
}
run();
