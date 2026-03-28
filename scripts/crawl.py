import urllib.request
import json
import re
import os
import time

def fetch_page(pg):
    url = f"https://superkts.com/lotto/list/?pg={pg}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")
        return html
    except:
        return None

def parse_html(html):
    rows = re.findall(
        r'<tr><td>(\d+)</td><td><span[^>]+>(\d+)</span></td><td><span[^>]+>(\d+)</span></td><td><span[^>]+>(\d+)</span></td><td><span[^>]+>(\d+)</span></td><td><span[^>]+>(\d+)</span></td><td><span[^>]+>(\d+)</span></td><td><span[^>]+>(\d+)</span></td>',
        html
    )
    results = []
    for r in rows:
        nums = sorted([int(r[1]),int(r[2]),int(r[3]),int(r[4]),int(r[5]),int(r[6])])
        results.append({"round": int(r[0]), "nums": nums, "bonus": int(r[7])})
    return results

def main():
    if os.path.exists("lotto.json"):
        with open("lotto.json", "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_rounds = {d["round"] for d in existing}
        print(f"기존 데이터: {len(existing)}회차")
    else:
        existing = []
        existing_rounds = set()
        print("새로 시작")

    print("최신 회차 확인 중...")
    new_data = []

    for pg in range(1, 4):
        html = fetch_page(pg)
        if not html:
            print(f"페이지 {pg} 실패")
            continue
        rows = parse_html(html)
        for row in rows:
            if row["round"] not in existing_rounds:
                new_data.append(row)
                print(f"새 데이터: {row['round']}회 {row['nums']} 보너스 {row['bonus']}")
        time.sleep(0.5)

    if not new_data:
        print("새로운 데이터 없음 (이미 최신 상태)")
        return

    all_data = existing + new_data
    all_data = list({d["round"]: d for d in all_data}.values())
    all_data.sort(key=lambda x: x["round"], reverse=True)

    with open("lotto.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"완료! 총 {len(all_data)}회차 저장 (신규 {len(new_data)}개 추가)")

if __name__ == "__main__":
    main()
