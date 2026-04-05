import lottoData from '../lotto.json' assert { type: 'json' };

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(lottoData);
}
