const axios = require('axios');
const cheerio = require('cheerio');

async function testRakuten() {
  const { data } = await axios.get('https://www.rakuten.com', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const $ = cheerio.load(data);
  let c = 0;
  $('a').each((i, el) => {
    const text = $(el).text().trim().replace(/\\s+/g, ' ');
    const href = $(el).attr('href');
    if (text.toLowerCase().includes('cash back')) {
       console.log(text.substring(0, 80), '=>', href);
       c++;
    }
  });

  console.log(`Found ${c} elements with cash back text`);
}
testRakuten().catch(console.error);
