export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 파라미터 필요' });

  try {
    // 동행복권 실제 당첨번호 JSON API (공식)
    const response = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'lotto-app/1.0',
          'Accept': '*/*',
        },
        // Vercel Edge에서 캐시 안 함
        cache: 'no-store',
      }
    );

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text preview:', text.substring(0, 200));

    if (!text.trim().startsWith('{')) {
      // HTML 응답 왔을 때 - 직접 파싱 시도 (나눔로또 미러)
      const mirror = await fetch(
        `https://lotto.naverblog.net/api/lotto/${round}`
      );
      if (mirror.ok) {
        const data = await mirror.json();
        return res.status(200).json(data);
      }
      return res.status(502).json({ 
        error: 'HTML 응답', 
        preview: text.substring(0, 100) 
      });
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
