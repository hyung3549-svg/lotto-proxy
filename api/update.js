import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "hyung3549-svg";
const REPO = "lotto-proxy";

async function fetchRound(rnd) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${rnd}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  const text = await res.text();
  console.log(`${rnd}회 응답: ${text.substring(0, 100)}`);
  if (!text.trim().startsWith("{")) return null;
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

async function getLatestRound(latestExisting) {
  // 방법1: 기존 최신+1부터 순서대로 시도해서 실패하면 그 전이 최신
  console.log(`최신 회차 확인: ${latestExisting + 1}회 시도`);
  const result = await fetchRound(latestExisting + 1);
  if (result) {
    console.log(`${latestExisting + 1}회 존재!`);
    return latestExisting + 1;
  }
  console.log(`${latestExisting + 1}회 없음`);
  return null;
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

    // 최신+1 회차 직접 시도
    const newRounds = [];
    for (let rnd = latestExisting + 1; rnd <= latestExisting + 5; rnd++) {
      const result = await fetchRound(rnd);
      if (!result) {
        console.log(`${rnd}회 없음 - 종료`);
        break;
      }
      newRounds.push(result);
      console.log(`✅ ${rnd}회 ${result.date} ${result.nums}`);
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
