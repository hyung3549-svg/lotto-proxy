import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 파라미터 필요' });

  const data = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.dhlottery.co.kr',
      path: `/common.do?method=getLottoNumber&drwNo=${round}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.dhlottery.co.kr/gameInfo.do?method=lotteryGame',
        'Cookie': 'WMONID=test; JSESSIONID=test',
      },
    };

    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('timeout'));
    });
    request.end();
  });

  try {
    if (data.body.trim().startsWith('{')) {
      const json = JSON.parse(data.body);
      if (json.returnValue === 'success') {
        return res.status(200).json(json);
      }
    }
    return res.status(502).json({
      error: 'HTML 응답',
      preview: data.body.substring(0, 200)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
