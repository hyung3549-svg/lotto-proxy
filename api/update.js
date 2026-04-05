import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "hyung3549-svg";
const REPO = "lotto-proxy";

async function fetchRound(rnd) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${rnd}`;
  console.log(`API 호출: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  console.log(`응답 status: ${res.status}`);
  const text = await res.text();
  console.log(`응답 앞 200자: ${text.substring(0, 200)}`);
  if (!text.trim().startsWith("{")) {
    console.log("JSON 아님 - 차단됨");
    return null;
  }
  const data = JSON.parse(text);
  if (data.returnValue !== "success") {
    console.log(`returnValue: ${data.returnValue}`);
    return null;
  }
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
  const url = "https://www.dhlottery.co.kr/common.do?method=main";
  console.log(`메인 호출: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  console.log(`메인 status: ${res.status}`);
  const html = await res.text();
  console.log(`메인 앞 500자: ${html.substring(0, 500)}`);
  const m = html.match(/<strong id="lottoDrwNo">(\d+)<\/strong>/);
  if (m) {
    console.log(`최신 회차: ${m[1]}`);
    return parseInt(m[1]);
  }
  console.log("회차 파싱 실패");
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

    const latestRound = await getLatestRound();
    if (!latestRound || latestRound <= latestExisting) {
      return res.json({ message: "새 데이터 없음", latestRound, latestExisting });
    }

    const newRounds = [];
    for (let rnd = latestExisting + 1; rnd <= latestRound; rnd++) {
      const result = await fetchRound(rnd);
      if (result) {
        newRounds.push(result);
        console.log(`✅ ${rnd}회 추가`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (newRounds.length === 0) {
      return res.json({ message: "수집 실패", latestRound });
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
