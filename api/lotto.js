import https from 'https';

function httpGet(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.dhlottery.co.kr/',
      },
    };

    const req = https.request(options, (res) => {
      // 리다이렉트 처리
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://${urlObj.hostname}${res.headers.location}`;
        return resolve(httpGet(next, redirectCount + 1));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 필요' });

  try {
    const result = await httpGet(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`
    );

    if (result.body.trim().startsWith('{')) {
      const json = JSON.parse(result.body);
      if (json.returnValue === 'success') {
        return res.status(200).json(json);
      }
    }

    return res.status(502).json({
      error: 'HTML 응답',
      preview: result.body.substring(0, 200)
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

Commit 후 확인해주세요!
```
https://lotto-proxy-36il.vercel.app/api/lotto?round=1150
