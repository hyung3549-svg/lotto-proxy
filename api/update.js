import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "hyung3549-svg";
const REPO = "lotto-proxy";

async function fetchRoundFromPyony(rnd) {
  const url = `https://pyony.com/lotto/rounds/${rnd}/`;
  console.log(`pyony 호출: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  console.log(`status: ${res.status}`);
  if (res.status === 404) return null;
  const html = await res.text();
  console.log(`html 앞 500자: ${html.substring(0, 500)}`);

  // 번호 파싱
  const nums = [...html.matchAll(/class="[^"]*ball[^"]*"[^>]*>\s*(\d+)\s*</g)].map(m => parseInt(m[1]));
  const dateM = html.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  const date = dateM ? `${dateM[1]}-${String(dateM[2]).padStart(2,'0')}-${String(dateM[3]).padStart(2,'0')}` : '';

  console.log(`파싱된 번호: ${nums}`);
  console.log(`파싱된 날짜: ${date}`);

  if (nums.length < 6) return null;

  return {
    round: rnd,
    date,
    nums: nums.slice(0, 6).sort((a, b) => a - b),
    bonus: nums[6] || 0,
    prize1: 0,
    prize1Cnt: 0,
  };
}

export default async function handler(req, res) {
  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const { data: fileData } = await octokit.repos.getContent({
      owner: OWNER, repo: REPO, path: "lotto.json",
    });
    const existing = JSON.parse(Buffer.from(fileData.content, "base64").toString());
    const latestExisting = Math.max(...existing.map((d) => d.round));
    console.log(`기존 최신: ${latestExisting}회`);

    const newRounds = [];
    for (let rnd = latestExisting + 1; rnd <= latestExisting + 5; rnd++) {
      const result = await fetchRoundFromPyony(rnd);
      if (!result) {
        console.log(`${rnd}회 없음 - 종료`);
        break;
      }
      newRounds.push(result);
      console.log(`✅ ${rnd}회 ${result.date} ${result.nums} 보너스:${result.bonus}`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (newRounds.length === 0) {
      return res.json({ message: "새 회차 없음", latestExisting });
    }

    const allData = [...newRounds, ...existing];
    const content = Buffer.from(JSON.stringify(allData, null, 2)).toString("base64");

    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path: "lotto.json",
      message: "chore: auto-update lotto data",
      content,
      sha: fileData.sha,
    });

    return res.json({ message: `✅ ${newRounds.length}회차 추가 완료`, rounds: newRounds.map((r) => r.round) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
