import urllib.request
import urllib.error
import json
import os
import time
import re

def fetch_lotto_by_round(round_no):
    """동행복권 공식 API로 회차별 당첨번호 조회"""
    url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={round_no}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
        "X-Requested-With": "XMLHttpRequest",
    })
    try:
        res = urllib.request.urlopen(req, timeout=15)
        text = res.read().decode("utf-8")
        data = json.loads(text)
        if data.get("returnValue") != "success":
            print(f"  {round_no}회: returnValue={data.get('returnValue')} (아직 미발표)")
            return None
        return {
            "round":     data["drwNo"],
            "date":      data["drwNoDate"],
            "nums":      sorted([
                data["drwtNo1"], data["drwtNo2"], data["drwtNo3"],
                data["drwtNo4"], data["drwtNo5"], data["drwtNo6"]
            ]),
            "bonus":     data["bnusNo"],
            "prize1":    data.get("firstWinamnt", 0),
            "prize1Cnt": data.get("firstPrzwnerCo", 0),
        }
    except urllib.error.HTTPError as e:
        print(f"  {round_no}회 HTTP오류: {e.code}")
        return None
    except json.JSONDecodeError as e:
        print(f"  {round_no}회 JSON파싱오류: {e}")
        return None
    except Exception as e:
        print(f"  {round_no}회 오류: {e}")
        return None


def get_latest_round():
    """동행복권 메인에서 최신 회차 번호 파싱"""
    url = "https://www.dhlottery.co.kr/common.do?method=main"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    try:
        res = urllib.request.urlopen(req, timeout=15)
        html = res.read().decode("utf-8", errors="ignore")
        m = re.search(r'<strong id="lottoDrwNo">(\d+)</strong>', html)
        if m:
            return int(m.group(1))
        # 대체 패턴
        m = re.search(r'"drwNo"\s*:\s*(\d+)', html)
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
            print(f"시도 {attempt}/{max_attempts} - 현재 최신 {latest_round}회 = 기존과 동일, 1분 대기...")
        else:
            print(f"시도 {attempt}/{max_attempts} - 조회 실패, 1분 대기...")

        if attempt < max_attempts:
            time.sleep(60)

    if not latest_round or latest_round <= latest_existing:
        print("30분 내 새 데이터 없음. 종료.")
        return

    # 누락 회차 포함해서 전부 수집
    new_data = []
    for rnd in range(latest_existing + 1, latest_round + 1):
        print(f"  {rnd}회차 수집 중...")
        result = fetch_lotto_by_round(rnd)
        if result:
            new_data.append(result)
            print(f"  ✅ {rnd}회 {result['date']} {result['nums']} 보너스:{result['bonus']}")
        else:
            print(f"  ❌ {rnd}회차 수집 실패")
        time.sleep(2)  # API 부하 방지

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