export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { round } = req.query;
  if (!round) return res.status(400).json({ error: 'round 파라미터 필요' });

  try {
    // GitHub raw 데이터 - 동행복권 전체 당첨번호 JSON
    const res2 = await fetch(
      `https://raw.githubusercontent.com/raben2/lotto/master/lotto.json`
    );
    const all = await res2.json();
    
    // 회차 찾기
    const item = all.find(d => d.drwNo === Number(round));
    if (item) {
      return res.status(200).json({ ...item, returnValue: 'success' });
    }
    return res.status(404).json({ error: '해당 회차 없음' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

Commit 후 확인해주세요!
```
https://lotto-proxy-36il.vercel.app/api/lotto?round=1150
