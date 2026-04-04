const axios = require('axios');
const cheerio = require('cheerio');

async function check() {
  try {
    const { data } = await axios.get('https://www.rakuten.com/stores/all/index.htm', {
      headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    });
    const $ = cheerio.load(data);
    let nextData = $('#__NEXT_DATA__').html();
    if (nextData) {
      const j = JSON.parse(nextData);
      const stores = j.props?.pageProps?.initialState?.storeData?.stores;
      if (stores) {
        console.log("Found", Object.keys(stores).length, "stores");
        console.log(Object.values(stores).slice(0, 3).map(s => s.name + " " + s.cashback?.formatted));
      } else {
        console.log("No storeData.stores in HTML NEXT_DATA");
      }
    } else {
      console.log('No NEXT_DATA');
    }
  } catch(e) {
    console.error(e.message);
  }
}
check();
