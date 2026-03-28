export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 파라미터 필요' });

  // 여러 공개 API 순서대로 시도
  const apis = [
    // API 1: 비공식 로또 API
    async () => {
      const r = await fetch(`https://lottoapi.lottoblog.co.kr/lotto/${round}`);
      const d = await r.json();
      if (d && d.drwtNo1) return {
        returnValue: 'success',
        drwNo: d.drwNo,
        drwNoDate: d.drwNoDate,
        drwtNo1: d.drwtNo1, drwtNo2: d.drwtNo2, drwtNo3: d.drwtNo3,
        drwtNo4: d.drwtNo4, drwtNo5: d.drwtNo5, drwtNo6: d.drwtNo6,
        bnusNo: d.bnusNo,
        firstWinamnt: d.firstWinamnt,
        firstPrzwnerCo: d.firstPrzwnerCo,
      };
    },
    // API 2: 동행복권 직접 (혹시 될 수도)
    async () => {
      const r = await fetch(
        `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
      );
      const text = await r.text();
      if (text.trim().startsWith('{')) {
        const d = JSON.parse(text);
        if (d.returnValue === 'success') return d;
      }
    },
  ];

  for (const api of apis) {
    try {
      const data = await api();
      if (data) return res.status(200).json(data);
    } catch {}
  }

  return res.status(500).json({ error: '모든 API 실패' });
}
```

Commit 후 다시 확인해주세요!
```
https://lotto-proxy-36il.vercel.app/api/lotto?round=1150
