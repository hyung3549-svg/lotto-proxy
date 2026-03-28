export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 파라미터 필요' });

  // 여러 URL 패턴으로 시도
  const urls = [
    `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
    `https://m.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.dhlottery.co.kr/gameInfo.do?method=lotteryGame',
          'Origin': 'https://www.dhlottery.co.kr',
        },
      });

      const text = await response.text();
      
      // HTML이 아닌 JSON인지 확인
      if (text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        if (data.returnValue === 'success') {
          return res.status(200).json(data);
        }
      }
    } catch (e) {
      continue;
    }
  }

  return res.status(500).json({ error: '동행복권 API 응답 실패' });
}
