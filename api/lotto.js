export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 파라미터 필요' });

  try {
    const response = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.dhlottery.co.kr/gameInfo.do?method=lotteryGame&wiselog=H_C_1_1',
          'Connection': 'keep-alive',
        },
      }
    );

    const text = await response.text();

    if (text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      if (data.returnValue === 'success') {
        return res.status(200).json(data);
      }
    }

    // 로그 확인용
    return res.status(502).json({
      error: 'HTML 응답',
      status: response.status,
      preview: text.substring(0, 300),
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
