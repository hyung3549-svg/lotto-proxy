import urllib.request
import urllib.error
import json
import re
import os
import time

def fetch_round_dhlottery(round_no):
    """동행복권 당첨결과 페이지 HTML에서 파싱 (로그인 불필요)"""
    url = f"https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo={round_no}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
    })
    try:
        res = urllib.request.urlopen(req, timeout=15)
        html = res.read().decode("utf-8", errors="ignore")

        # 번호 파싱: <span class="ball_645 lball_...">숫자</span>
        nums = re.findall(r'class="ball_645[^"]*"[^>]*>\s*(\d+)\s*<', html)
        bonus_m = re.findall(r'class="ball_645[^"]*bonus[^"]*"[^>]*>\s*(\d+)\s*<', html)

        # 날짜 파싱
        date_m = re.search(r'(\d{4})년\s*(\d{2})월\s*(\d{2})일', html)
        if not date_m:
            date_m = re.search(r'drwNoDate.*?(\d{4}-\d{2}-\d{2})', html)
        date = ""
        if date_m:
            try:
                date = f"{date_m.group(1)}-{date_m.group(2)}-{date_m.group(3)}"
            except:
                date = date_m.group(1)

        # 1등 정보
        prize_m = re.search(r'1등[^<]*<[^>]*>[^<]*<[^>]*>\s*([\d,]+)', html)
        cnt_m = re.search(r'1등[^<]*<[^>]*>[^<]*<[^>]*>[^<]*<[^>]*>\s*(\d+)', html)
        prize1 = int(prize_m.group(1).replace(',','')) if prize_m else 0
        prize1Cnt = int(cnt_m.group(1)) if cnt_m else 0

        if len(nums) < 6:
            print(f"  {round_no}회: 번호 파싱 실패")
            return None

        main_nums = sorted([int(n) for n in nums[:6]])
        bonus = int(bonus_m[0]) if bonus_m else (int(nums[6]) if len(nums) > 6 else 0)

        return {
            "round": round_no,
            "date": date,
            "nums": main_nums,
            "bonus": bonus,
            "prize1": prize1,
            "prize1Cnt": prize1Cnt,
        }
    except Exception as e:
        print(f"  {round_no}회 오류: {e}")
        return None


def get_latest_round():
    """동행복권 당첨결과 페이지에서 최신 회차 확인"""
    url = "https://www.dhlottery.co.kr/gameResult.do?method=byWin"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    try:
        res = urllib.request.urlopen(req, timeout=15)
        html = res.read().decode("utf-8", errors="ignore")
        # <strong id="lottoDrwNo"> 또는 option selected
        m = re.search(r'<strong[^>]*id="lottoDrwNo"[^>]*>(\d+)<', html)
        if m:
            return int(m.group(1))
        # select option에서 찾기
        m = re.search(r'<option[^>]*selected[^>]*value="(\d+)"', html)
        if m:
            return int(m.group(1))
        # drwNo 패턴
        m = re.search(r'drwNo=(\d+)[^0-9]', html)
        if m:
            return int(m.group(1))
    except Exception as e:
        print(f"최신 회차 조회 실패: {e}")
    return None


def main():
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

    print("동행복권 당첨결과 페이지에서 최신 회차 확인 중...")
    max_attempts = 30
    latest_round = None

    for attempt in range(1, max_attempts + 1):
        latest_round = get_latest_round()
        if latest_round and latest_round > latest_existing:
            print(f"새 회차 발견: {latest_round}회!")
            break
        elif latest_round:
            print(f"시도 {attempt}/{max_attempts} - 최신:{latest_round}회 = 기존과 동일, 1분 대기...")
        else:
            print(f"시도 {attempt}/{max_attempts} - 조회 실패, 1분 대기...")
        if attempt < max_attempts:
            time.sleep(60)

    if not latest_round or latest_round <= latest_existing:
        print("30분 내 새 데이터 없음. 종료.")
        return

    new_data = []
    for rnd in range(latest_existing + 1, latest_round + 1):
        print(f"  {rnd}회차 수집 중...")
        result = fetch_round_dhlottery(rnd)
        if result:
            new_data.append(result)
            print(f"  ✅ {rnd}회 {result['date']} {result['nums']} 보너스:{result['bonus']}")
        else:
            print(f"  ❌ {rnd}회차 수집 실패")
        time.sleep(2)

    if not new_data:
        print("새 데이터 수집 실패. 종료.")
        return

    all_data = existing + new_data
    all_data = list({d["round"]: d for d in all_data}.values())
    all_data.sort(key=lambda x: x["round"], reverse=True)

    with open("lotto.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 완료! {[d['round'] for d in new_data]}회차 추가, 총 {len(all_data)}회차 저장!")


if __name__ == "__main__":
    main()
