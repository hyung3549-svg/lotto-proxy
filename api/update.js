import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "hyung3549-svg";
const REPO = "lotto-proxy";

async function fetchLatestRounds() {
  const url = "https://pyony.com/lotto/rounds/?format=json";
  console.log(`pyony.com 호출: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });
  console.log(`응답 status: ${res.status}`);
  const data = await res.json();
  console.log(`데이터 구조 샘플: ${JSON.stringify(data).substring(0, 300)}`);
  return data;
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

    // pyony.com에서 최신 데이터 가져오기
    const pyonyData = await fetchLatestRounds();
    console.log(`pyony 데이터 타입: ${typeof pyonyData}, isArray: ${Array.isArray(pyonyData)}`);

    return res.json({ message: "구조 확인용", sample: JSON.stringify(pyonyData).substring(0, 500) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
