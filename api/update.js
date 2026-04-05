import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "hyung3549-svg";
const REPO = "lotto-proxy";

async function fetchRound(rnd) {
  const url = `https://dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${rnd}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json, text/javascript, */*",
      "Referer": "https://dhlottery.co.kr/",
    },
  });
  const text = await res.text();
  if (!text.startsWith("{")) return null;
  const data = JSON.parse(text);
  if (data.returnValue !== "success") return null;
  return {
    round: data.drwNo,
    date: data.drwNoDate,
    nums: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a, b) => a - b),
    bonus: data.bnusNo,
    prize1: data.firstWinamnt || 0,
    prize1Cnt: data.firstPrzwnerCo || 0,
  };
}

async function getLatestRound() {
  const res = await fetch("https://dhlottery.co.kr/common.do?method=main", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  const html = await res.text();
  const m = html.match(/<strong id="lottoDrwNo">(\d+)<\/strong>/);
  return m ? parseInt(m[1]) : null;
}

export default async function handler(req, res) {
  // Vercel Cron 인증
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // 현재 lotto.json 가져오기
    const { data: fileData } = await octokit.repos.getContent({
      owner: OWNER, repo: REPO, path: "lotto.json",
    });
    const existing = JSON.parse(Buffer.from(fileData.content, "base64").toString());
    const latestExisting = Math.max(...existing.map((d) => d.round));

    console.log(`기존 최신: ${latestExisting}회`);

    // 최신 회차 확인
    const latestRound = await getLatestRound();
    if (!latestRound || latestRound <= latestExisting) {
      return res.json({ message: "새 데이터 없음", latestRound, latestExisting });
    }

    console.log(`새 회차 발견: ${latestRound}회`);

    // 새 회차 수집
    const newRounds = [];
    for (let rnd = latestExisting + 1; rnd <= latestRound; rnd++) {
      const result = await fetchRound(rnd);
      if (result) {
        newRounds.push(result);
        console.log(`✅ ${rnd}회 ${result.date} ${result.nums}`);
      } else {
        console.log(`❌ ${rnd}회 실패`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (newRounds.length === 0) {
      return res.json({ message: "수집 실패" });
    }

    // GitHub에 push
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
