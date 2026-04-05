import lottoData from '../lotto.json' with { type: 'json' };
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(lottoData);
}
