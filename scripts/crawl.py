import urllib.request
import json
import re
import os
import time

def fetch_round(rnd):
    url = f"https://pyony.com/lotto/rounds/{rnd}/"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "ko-KR,ko;q=0.9",
    })
    try:
        res = urllib.request.urlopen(req, timeout=15)
        if res.status == 404:
            return None
        html = res.read().decode("utf-8", errors="ignore")

        # 번호: <div class="d-inline-block numberCircle ..."><strong>숫자</strong></div>
        nums = [int(m.group(1)) for m in re.finditer(
            r'class="[^"]*numberCircle[^"]*"[^>]*>\s*<strong>(\d+)</strong>', html
        )]

        # 날짜
        date_m = re.search(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일', html)
        date = f"{date_m.group(1)}-{int(date_m.group(2)):02d}-{int(date_m.group(3)):02d}" if date_m else ""

        # 1등 당첨금
        prize_m = re.search(r'1등</th>\s*<td[^>]*>(\d+)</td>\s*<td[^>]*><a[^>]*>([0-9,]+)</a>', html)
        prize1 = int(prize_m.group(2).replace(',', '')) if prize_m else 0
        prize1Cnt = int(prize_m.group(1)) if prize_m else 0

        print(f"  {rnd}회 nums:{nums} date:{date}")

        if len(nums) < 7:
            print(f"  {rnd}회 번호 부족 ({len(nums)}개)")
            return None

        return {
            "round": rnd,
            "date": date,
            "nums": sorted(nums[:6]),
            "bonus": nums[6],
            "prize1": prize1,
            "prize1Cnt": prize1Cnt,
        }
    except Exception as e:
        print(f"  {rnd}회 오류: {e}")
        return None

def main():
    with open("lotto.json", "r", encoding="utf-8") as f:
        existing = json.load(f)
    latest_existing = max(d["round"] for d in existing)
    print(f"기존 최신: {latest_existing}회")

    new_rounds = []
    for rnd in range(latest_existing + 1, latest_existing + 6):
        print(f"{rnd}회차 시도...")
        result = fetch_round(rnd)
        if not result:
            print(f"{rnd}회 없음 - 종료")
            break
        new_rounds.append(result)
        print(f"✅ {rnd}회 {result['date']} {result['nums']} 보너스:{result['bonus']}")
        time.sleep(2)

    if not new_rounds:
        print("새 회차 없음.")
        return

    all_data = new_rounds + existing
    all_data = list({d["round"]: d for d in all_data}.values())
    all_data.sort(key=lambda x: x["round"], reverse=True)

    with open("lotto.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(new_rounds)}회차 추가 완료!")

if __name__ == "__main__":
    main()
