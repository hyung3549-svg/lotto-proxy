import urllib.request
import json
import os
import time

# 동행복권 공식 API - 회차별 당첨번호 조회
def fetch_lotto_by_round(round_no):
    url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round_no}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.dhlottery.co.kr/",
    })
    try:
        res = urllib.request.urlopen(req, timeout=10)
        data = json.loads(res.read().decode("utf-8"))
        if data.get("returnValue") != "success":
            return None
        return {
            "round": data["drwNo"],
            "date":  data["drwNoDate"],
            "nums":  sorted([
                data["drwtNo1"], data["drwtNo2"], data["drwtNo3"],
                data["drwtNo4"], data["drwtNo5"], data["drwtNo6"]
            ]),
            "bonus": data["bnusNo"],
            "prize1":    data.get("firstWinamnt", 0),
            "prize1Cnt": data.get("firstPrzwnerCo", 0),
        }
    except Exception as e:
        print(f"  오류: {e}")
        return None

# 현재 최신 회차 조회
def get_latest_round():
    url = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=1"
    # 최신 회차는 drwNo 없이 호출하면 나옴
    url = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=9999"
    # → 실패하므로 메인 페이지에서 파싱
    try:
        import re
        req = urllib.request.Request(
            "https://www.dhlottery.co.kr/common.do?method=main",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")
        m = re.search(r'<strong id="lottoDrwNo">(\d+)</strong>', html)
        if m:
            return int(m.group(1))
    except Exception as e:
        print(f"최신 회차 조회 실패: {e}")
    return None

def main():
    # 기존 데이터 로드
    if os.path.exists("lotto.json"):
        with open("lotto.json", "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_rounds = {d["round"] for d in existing}
        latest_existing = max(existing_rounds)
        print(f"기존 데이터: {len(existing)}회차 (최신: {latest_existing}회)")
    else:
        existing = []
        existing_rounds = set()
        latest_existing = 0

    # 최신 회차 확인 (최대 30분 재시도)
    print("동행복권 최신 회차 확인 중...")
    max_attempts = 30
    latest_round = None

    for attempt in range(1, max_attempts + 1):
        latest_round = get_latest_round()
        if latest_round and latest_round > latest_existing:
            print(f"새 회차 발견: {latest_round}회!")
            break
        elif latest_round:
            print(f"시도 {attempt}/{max_attempts} - 아직 최신({latest_round}회) = 기존({latest_existing}회), 1분 대기...")
        else:
            print(f"시도 {attempt}/{max_attempts} - 회차 조회 실패, 1분 대기...")

        if attempt < max_attempts:
            time.sleep(60)

    if not latest_round or latest_round <= latest_existing:
        print("30분 내 새 데이터 없음. 종료.")
        return

    # 새 회차들 수집 (혹시 여러 회차 누락됐을 경우 대비)
    new_data = []
    for rnd in range(latest_existing + 1, latest_round + 1):
        print(f"  {rnd}회차 수집 중...")
        result = fetch_lotto_by_round(rnd)
        if result:
            new_data.append(result)
            print(f"  ✅ {rnd}회 {result['date']} {result['nums']} 보너스:{result['bonus']}")
        else:
            print(f"  ❌ {rnd}회차 수집 실패")
        time.sleep(1)  # API 부하 방지

    if not new_data:
        print("새 데이터 수집 실패. 종료.")
        return

    # 병합 및 저장
    all_data = existing + new_data
    all_data = list({d["round"]: d for d in all_data}.values())
    all_data.sort(key=lambda x: x["round"], reverse=True)

    with open("lotto.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 완료! {[d['round'] for d in new_data]}회차 추가, 총 {len(all_data)}회차 저장!")

if __name__ == "__main__":
    main()