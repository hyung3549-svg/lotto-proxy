export default function handler(req, res) {
  const lottoData = require('../lotto.json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(lottoData);
}
